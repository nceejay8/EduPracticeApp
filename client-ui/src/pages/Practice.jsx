import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiLearningIcon } from '@hugeicons/core-free-icons';
import { useLocalization } from '../contexts/LocalizationContext';
import { examLevels } from '../data/examStructure';
import { getSubject, getTopic, listChapters, normalizeSubject, normalizeLevelId, levelToLevelId } from '../data/syllabus';
import { getTopicCoverage } from '../data/syllabusProgress';
import { pickScenarioForSyllabusTopic } from '../data/practiceScenarios';
import ChatInterface from '../components/ChatInterface';
import { trackPracticeAttempt, trackTopicView } from '../utils/analyticsTracker';
import { useAuth } from '../contexts/AuthContext';
import { evaluatePracticeSolution } from '../services/practiceAiService';

const PRACTICE_DRAFT_KEY = 'eduPractice_practiceDraft';

function loadPracticeDraft() {
  try {
    const raw = localStorage.getItem(PRACTICE_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePracticeDraft(draft) {
  localStorage.setItem(PRACTICE_DRAFT_KEY, JSON.stringify(draft));
}

function ModelSearchingIndicator() {
  const [currentModel, setCurrentModel] = useState(0);
  const models = [
    'Llama 3.2',
    'WizardLM',
    'Gemma 7B',
    'Mistral',
    'Zephyr'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentModel((prev) => (prev + 1) % models.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-[#f99c00] rounded-full animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-300 font-medium">
        Finding best AI model...
      </span>
      <span className="text-xs text-[#f99c00] font-mono">
        {models[currentModel]}
      </span>
    </div>
  );
}

// Subject metadata for the level/subject cards.
const SUBJECT_CARDS = {
  physics: {
    id: 'physics',
    icon: 'solar:flash-bold',
    color: 'from-blue-500 to-cyan-500',
  },
  mathematics: {
    id: 'mathematics',
    icon: 'solar:calculator-bold',
    color: 'from-rose-500 to-pink-500',
  },
};

export default function Practice() {
  const { t } = useLocalization();
  // Only used to attribute the attempt to a user id for cross-device sync. The
  // attempt is recorded locally either way, so an anonymous or signed-out
  // student still gets full progress.
  const { user: authUser } = useAuth();
  const authUserId = authUser?.id || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const draft = useMemo(() => loadPracticeDraft(), []);

  // ── Resolve any deep link before first paint ──────────────────────────────
  // /practice?level=uace&subject=physics&topic=phy-mech-energy
  //   → a subject with its outline open
  // /practice?subject=physics
  //   → a subject with its outline open
  // /practice?subject=physics&topic=phy-mech-energy
  //   → straight into the workboard on that topic
  const deepLink = useMemo(() => {
    const subject = normalizeSubject(searchParams.get('subject'));
    const topicId = searchParams.get('topic');
    // Canonical parser, so links carrying the raw label ('UACE') work as well as
    // the id ('uace'). This page keeps levels as ids internally.
    const level = levelToLevelId(normalizeLevelId(searchParams.get('level')) || 'A-Level');
    if (!subject && !topicId) return null;

    // A topic is only honoured when it really exists in that subject, so a stale
    // or hand-edited link degrades to the subject outline instead of a dead end.
    const found = subject ? getTopic(subject, topicId) : null;
    const topic = found
      ? {
          subjectId: subject,
          chapterId: found.chapter.id,
          topicId: found.topic.id,
          topicName: found.topic.name,
        }
      : null;
    return { subject, topic, level };
  }, []);

  const [step, setStep] = useState(draft?.step || 'selectLevel'); // selectLevel | topics | workboard
  const [selectedExamLevel, setSelectedExamLevel] = useState(deepLink?.level || draft?.selectedExamLevel || null);
  const [selectedSubject, setSelectedSubject] = useState(deepLink?.subject || draft?.selectedSubject || null);
  const [selectedTopicRef, setSelectedTopicRef] = useState(
    deepLink?.topic || draft?.selectedTopicRef || null
  );
  const [aiState, setAiState] = useState(draft?.feedback ? 'feedback' : 'idle'); // idle | analyzing | feedback
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [solutionText, setSolutionText] = useState(draft?.solutionText || '');
  const [selectedFileName, setSelectedFileName] = useState(draft?.selectedFileName || '');
  const [feedback, setFeedback] = useState(draft?.feedback || null);
  const [error, setError] = useState('');
  const inputFileRef = useRef(null);
  const workboardStartedAt = useRef(Date.now());

  // A valid deep link takes over from whatever the draft held. `normalizeSubject`
  // already returns a canonical subject id, so it is applied directly here.
  useEffect(() => {
    if (!deepLink) return;
    if (deepLink.topic) {
      setStep('workboard');
      setSelectedSubject(deepLink.topic.subjectId);
      setSelectedTopicRef(deepLink.topic);
      setSelectedExamLevel(prev => prev || deepLink.level || 'a-level');
    } else if (deepLink.subject) {
      setStep('topics');
      setSelectedSubject(deepLink.subject);
      setSelectedExamLevel(prev => prev || deepLink.level || 'a-level');
    }
  }, [deepLink]);

  const subject = useMemo(() => getSubject(selectedSubject), [selectedSubject]);
  const chapters = useMemo(
    () => (selectedSubject ? listChapters(selectedSubject) : []),
    [selectedSubject]
  );

  // Get the practice scenario for the selected syllabus topic.
  // Topic-scoped rather than subject-scoped, so drilling into a topic actually
  // serves a question from that topic.
  const currentScenario = useMemo(() => {
    if (!selectedTopicRef) return null;
    try {
      return pickScenarioForSyllabusTopic(selectedTopicRef.subjectId, selectedTopicRef.topicId);
    } catch (err) {
      console.error('Failed to load scenario:', err);
      return null;
    }
  }, [selectedTopicRef]);

  // True when the topic exists in the syllabus but has no material behind it yet.
  const topicHasNoMaterial = useMemo(() => {
    if (!selectedTopicRef) return false;
    return getTopicCoverage(selectedTopicRef.subjectId, selectedTopicRef.topicId).total === 0;
  }, [selectedTopicRef]);

  useEffect(() => {
    savePracticeDraft({
      step,
      selectedExamLevel,
      selectedSubject,
      selectedTopicRef,
      solutionText,
      selectedFileName,
      feedback,
    });
  }, [step, selectedExamLevel, selectedSubject, selectedTopicRef, solutionText, selectedFileName, feedback]);

  const handleExamLevelSelect = (levelId) => {
    setSelectedExamLevel(levelId);
    setSelectedSubject(null);
    setSelectedTopicRef(null);
    setStep('topics');
    setSearchParams({ level: levelId });
  };

  const handleSubjectSelect = (subjectId) => {
    setSelectedSubject(subjectId);
    setSelectedTopicRef(null);
    setAiState('idle');
    setStep('topics');
  };

  const handleTopicSelect = (chapter, topic) => {
    const ref = {
      subjectId: selectedSubject,
      chapterId: chapter.id,
      topicId: topic.id,
      topicName: topic.name,
    };
    setSelectedTopicRef(ref);
    trackTopicView(topic.name, topic.id);
    setSolutionText('');
    setSelectedFileName('');
    setFeedback(null);
    setError('');
    workboardStartedAt.current = Date.now();
    setStep('workboard');
    setSearchParams({
      level: selectedExamLevel || 'a-level',
      subject: selectedSubject,
      topic: topic.id,
    });
  };

  const handleBackToTopics = () => {
    setStep('topics');
    setSelectedTopicRef(null);
    setAiState('idle');
    setSolutionText('');
    setSelectedFileName('');
    setFeedback(null);
    setError('');
    setSearchParams({ level: selectedExamLevel || 'a-level', subject: selectedSubject });
  };

  const handleBackToExamLevel = () => {
    setStep('selectLevel');
    setSelectedExamLevel(null);
    setSelectedSubject(null);
    setSelectedTopicRef(null);
    setAiState('idle');
    setFeedback(null);
    setError('');
    setSearchParams({});
  };

  const handleSubmit = async () => {
    if (aiState !== 'idle') return;

    // Validate solution
    if (!solutionText.trim()) {
      setError('Please write your solution before submitting for evaluation.');
      return;
    }

    // Validate scenario is loaded
    if (!currentScenario) {
      setError('Practice question failed to load. Please try again.');
      return;
    }

    setError('');
    setAiState('analyzing');

    try {
      if (!selectedTopicRef) {
        throw new Error('Topic information is missing.');
      }

      const result = await evaluatePracticeSolution({
        subject: subject?.name || selectedTopicRef.subjectId,
        level: selectedExamLevel?.toUpperCase().replace('-', ' ') || 'A-Level',
        topic: currentScenario.topic || selectedTopicRef.topicName,
        question: currentScenario.stem,
        studentAnswer: solutionText.trim(),
        attachmentName: selectedFileName || null,
      });

      if (!result) {
        throw new Error('No evaluation response received.');
      }

      setFeedback(result);
      setAiState('feedback');

      const durationMinutes = Math.max(1, Math.round((Date.now() - workboardStartedAt.current) / 60000));
      try {
        // Record the syllabus topic, not the subject card. This is what makes
        // per-topic progress on /syllabus meaningful.
        trackPracticeAttempt(selectedTopicRef.topicName, result.score || 0, durationMinutes, {
          subject: selectedTopicRef.subjectId,
          topicId: selectedTopicRef.topicId,
          chapterId: selectedTopicRef.chapterId,
        }, authUserId);
      } catch (trackErr) {
        console.warn('Failed to track attempt:', trackErr);
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      const errorMsg = err?.message || 'AI evaluation failed. Please try again.';
      setError(errorMsg);
      setAiState('idle');
    }
  };

  // Reserve room on the right for the chat sidebar on large screens when chat is open
  const workboardPaneClass = isChatOpen ? 'lg:pr-[400px]' : '';

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#0B1120]">

      {/* EXAM LEVEL SELECTION SCREEN */}
      {step === 'selectLevel' ? (
        <div className="flex-1 overflow-y-auto w-full px-5 sm:px-8 md:px-10 py-8 sm:py-10 md:py-14">
          <div className="max-w-5xl mx-auto">

            {/* Header */}
            <div className="mb-8 sm:mb-10 md:mb-14">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-3 leading-[1.1]">
                {t('practice.chooseATopic')}
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-2xl">
                {t('examLevels.selectLevel')}
              </p>
            </div>

            {/* Exam Level Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {Object.values(examLevels).map((level) => (
                <button
                  key={level.id}
                  onClick={() => handleExamLevelSelect(level.id)}
                  className="group relative p-6 sm:p-7 md:p-8 rounded-2xl border border-white/10 bg-[#111827] hover:border-[#f99c00]/40 hover:bg-[#141d2e] transition-all duration-200 text-left active:scale-[0.98] flex flex-col gap-5 min-h-[180px]"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center text-white`}>
                    <Icon icon="solar:book-2-bold" width="22" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-1.5 group-hover:text-[#f99c00] transition-colors break-words">
                      {level.name}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{level.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      {level.difficulty}
                    </span>
                    <Icon icon="solar:arrow-right-linear" width="18" className="text-slate-500 group-hover:text-[#f99c00] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : step === 'topics' ? (
        // TOPIC SELECTION SCREEN
        <div className="flex-1 overflow-y-auto w-full px-5 sm:px-8 md:px-10 py-8 sm:py-10 md:py-14">
          <div className="max-w-5xl mx-auto">

            {/* Back Button */}
            <button
              onClick={handleBackToExamLevel}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-[#f99c00] transition-colors mb-6 sm:mb-8 text-sm font-medium group"
            >
              <Icon icon="solar:alt-arrow-left-linear" width="18" className="group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <span>{t('practice.backToTopics')}</span>
            </button>

            {/* Header */}
            <div className="mb-8 sm:mb-10 md:mb-12">
              <p className="text-xs text-[#f99c00] font-bold mb-3 uppercase tracking-[0.18em]">
                {selectedExamLevel?.toUpperCase().replace('-', ' ')}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-3 leading-[1.1]">
                {t('practice.chooseATopic')}
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-2xl">
                {t('practice.selectSubject')}
              </p>
            </div>

            {/* Subject cards — pick a subject, then drill into the outline below */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-10 md:mb-14">
              {Object.values(SUBJECT_CARDS).map((card) => {
                const active = selectedSubject === card.id;
                const cardSubject = getSubject(card.id);
                const topicCount = cardSubject ? cardSubject.chapters.reduce((s, c) => s + c.topics.length, 0) : 0;
                return (
                  <button
                    key={card.id}
                    onClick={() => handleSubjectSelect(card.id)}
                    className={`group relative p-6 sm:p-7 md:p-8 rounded-2xl border transition-all duration-200 text-left active:scale-[0.98] flex flex-col ${
                      active
                        ? 'border-[#f99c00]/60 bg-[#141d2e]'
                        : 'border-white/10 bg-[#111827] hover:border-[#f99c00]/40 hover:bg-[#141d2e]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-5 gap-3">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shrink-0`}>
                        <Icon icon={card.icon} width="22" />
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-white">{topicCount}</p>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{t('practice.topics')}</p>
                      </div>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-1.5 group-hover:text-[#f99c00] transition-colors break-words">
                      {t(`subjects.${card.id}`)}
                    </h3>

                    <p className="text-sm text-slate-400 leading-relaxed mb-5 flex-1">
                      {t(`subjects.${card.id}Description`)}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        {active ? t('practice.selected') : t('practice.startNow')}
                      </span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                        active
                          ? 'bg-[#f99c00] text-[#0B1120]'
                          : 'bg-[#f99c00]/10 text-[#f99c00] group-hover:bg-[#f99c00] group-hover:text-[#0B1120]'
                      }`}>
                        <Icon icon={active ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} width="16" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Inline outline for the selected subject */}
            {subject && (
              <section>
                <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    {subject.name} — {t('syllabus.syllabusOutline')}
                  </h2>
                  <Link
                    to={`/syllabus?subject=${subject.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#f99c00] hover:text-[#f88c00] transition-colors"
                  >
                    {t('syllabus.trackProgress')}
                    <Icon icon="solar:alt-arrow-right-linear" width="16" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {chapters.map((chapter) => (
                    <div key={chapter.id} className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden">
                      <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-white/5">
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 shrink-0">
                          <Icon icon={chapter.icon} width="18" />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white flex-1 min-w-0 truncate">{chapter.name}</h3>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                          {chapter.topics.length} {t('practice.topics')}
                        </span>
                      </div>

                      <div className="divide-y divide-white/5">
                        {chapter.topics.map((topic) => {
                          const coverage = getTopicCoverage(subject.id, topic.id);
                          return (
                            <button
                              key={topic.id}
                              onClick={() => handleTopicSelect(chapter, topic)}
                              disabled={coverage.total === 0}
                              className="w-full text-left px-5 sm:px-6 py-3.5 flex items-center gap-3 transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{topic.name}</p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {coverage.total > 0
                                    ? `${coverage.total} ${t('practice.itemsAvailable')}`
                                    : t('syllabus.comingSoon')}
                                </p>
                              </div>
                              {coverage.total > 0
                                ? <Icon icon="solar:alt-arrow-right-linear" width="16" className="text-slate-500 shrink-0" />
                                : <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 shrink-0">{t('syllabus.comingSoon')}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Features Section */}
            <div className="mt-12 md:mt-16">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4">{t('practice.whyPractice')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-xl bg-[#111827] border border-white/10 flex items-start gap-4 hover:border-[#f99c00]/30 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-[#f99c00]/10 flex items-center justify-center text-[#f99c00] shrink-0">
                    <Icon icon="solar:star-bold" width="18" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white mb-1">{t('practice.instantAiFeedback')}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{t('practice.getInstantAnalysis')}</p>
                  </div>
                </div>
                <div className="p-4 sm:p-5 rounded-xl bg-[#111827] border border-white/10 flex items-start gap-4 hover:border-emerald-500/30 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <Icon icon="solar:target-bold" width="18" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white mb-1">{t('practice.trackProgress')}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{t('practice.monitorGrowth')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // WORKBOARD SCREEN
        !currentScenario ? (
          <div className="flex-1 flex items-center justify-center px-5 py-8">
            <div className="text-center max-w-md">
              <div className="mb-6 w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Icon icon="solar:document-text-linear" width="32" className="text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {topicHasNoMaterial ? t('syllabus.noMaterialTitle') : t('syllabus.practiceUnavailableTitle')}
              </h2>
              <p className="text-slate-400 mb-6">
                {topicHasNoMaterial
                  ? t('syllabus.noMaterialBody')
                  : t('syllabus.practiceUnavailableBody')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleBackToTopics}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/15 hover:border-white/25 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Icon icon="solar:alt-arrow-left-linear" width="18" />
                  <span>{t('practice.backToTopics')}</span>
                </button>
                {selectedTopicRef && (
                  <Link
                    to="/mock-exams"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#f99c00] hover:bg-[#f88c00] text-[#0B1120] text-sm font-bold transition-all"
                  >
                    <Icon icon="solar:target-linear" width="18" />
                    <span>{t('syllabus.tryTopicExam')}</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
        <div className={`flex-1 overflow-y-auto w-full px-5 sm:px-8 md:px-10 py-8 sm:py-10 pb-32 lg:pb-10 ${workboardPaneClass} transition-[padding] duration-300`}>
          <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">

            {/* Back Button */}
            <button
              onClick={handleBackToTopics}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-[#f99c00] transition-colors text-sm font-medium group"
            >
              <Icon icon="solar:alt-arrow-left-linear" width="18" className="group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <span>{t('practice.backToTopics')}</span>
            </button>

            {/* Header */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2 text-[#f99c00] text-xs font-bold uppercase tracking-[0.18em] min-w-0">
                  <Icon icon="solar:book-bookmark-linear" width="16" className="shrink-0" />
                  <span className="truncate">{selectedTopicRef?.topicName}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold text-emerald-400">Ready</span>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white break-words mb-2 leading-tight">
                {selectedTopicRef?.topicName || 'Practice'} Question
              </h1>
              <p className="text-sm text-slate-400">
                {t('practice.maximumMark')}: <span className="font-semibold text-white">{currentScenario?.totalMarks || '10'}</span>
              </p>
            </div>

            {/* Scenario Card */}
            <div className="bg-[#111827] border border-white/10 rounded-2xl p-5 sm:p-6 md:p-8 space-y-5">
              {currentScenario?.source && (
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{currentScenario.source}</p>
              )}
              <p className="text-slate-300 leading-relaxed text-base sm:text-lg whitespace-pre-line">
                {currentScenario?.stem || 'Loading question...'}
              </p>
            </div>

            {/* Answer Section */}
            <div className="space-y-5">
              <h3 className="text-xl sm:text-2xl font-bold text-white">{t('practice.yourSolution')}</h3>

              <textarea
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
                placeholder="Write your derivation, working, substitutions, and final answer here."
                className="w-full min-h-48 rounded-2xl border border-white/10 bg-[#111827] px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f99c00]/40 disabled:opacity-50"
                disabled={aiState === 'analyzing'}
              />

              {/* Upload Area */}
              <div
                onClick={() => aiState !== 'analyzing' && inputFileRef.current?.click()}
                className={`w-full h-40 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#f99c00]/50 bg-[#111827]/50 flex flex-col items-center justify-center text-center transition-all duration-200 ${aiState === 'analyzing' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'} px-5`}
              >
                <input
                  ref={inputFileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                  disabled={aiState === 'analyzing'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        setError('File size must be less than 5MB');
                        return;
                      }
                      setSelectedFileName(file.name);
                      setError('');
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-full bg-white/5 group-hover:bg-[#f99c00]/10 flex items-center justify-center text-slate-400 group-hover:text-[#f99c00] transition-all mb-3">
                  <Icon icon="solar:upload-minimalistic-linear" width="24" />
                </div>
                <p className="text-base font-semibold text-white mb-1">{t('practice.clickToUpload')}</p>
                <p className="text-sm text-slate-500 max-w-xs">
                  {selectedFileName || `${t('practice.uploadDescription')} Attachment is optional.`}
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-3">
                  <Icon icon="solar:danger-bold" width="18" className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Action */}
              {aiState === 'analyzing' && <ModelSearchingIndicator />}
              {aiState !== 'feedback' && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={aiState !== 'idle' || !currentScenario}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f99c00] hover:bg-[#f88c00] text-[#0B1120] px-6 py-3.5 rounded-full text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] active:scale-95"
                  >
                    {aiState === 'analyzing' ? (
                      <>
                        <Icon icon="solar:loader-bold" width="20" className="animate-spin" />
                        <span>{t('practice.analyzing')}</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:magic-stick-3-linear" width="20" />
                        <span>{t('practice.submitForEvaluation')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Feedback */}
              {aiState === 'feedback' && feedback && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6 md:p-8 animate-fade-in-up relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>

                  <div className="flex flex-col sm:flex-row gap-5 sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-emerald-400 mb-3 flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" width="22" />
                        {t('practice.solutionEvaluated')}
                      </h3>
                      <div className="text-slate-300 text-sm md:text-base leading-relaxed space-y-3">
                        <p>{feedback.summary || 'Your solution has been evaluated.'}</p>
                        {feedback.strengths && feedback.strengths.length > 0 && (
                          <div>
                            <p className="font-semibold text-white mb-1">What you did well</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {feedback.strengths.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                        {feedback.improvements && feedback.improvements.length > 0 && (
                          <div>
                            <p className="font-semibold text-white mb-1">Improve next time</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {feedback.improvements.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                        {feedback.modelAnswer && (
                          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                            <p className="font-semibold text-white mb-1">Model answer outline</p>
                            <p>{feedback.modelAnswer}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-center justify-center p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 self-center sm:self-auto">
                      <span className="text-4xl font-bold text-emerald-400 font-mono">{feedback.score ?? 0}%</span>
                      <span className="text-[11px] font-bold text-emerald-500/80 uppercase tracking-widest mt-1">{t('practice.score')}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setAiState('idle');
                        setFeedback(null);
                        setSolutionText('');
                        setSelectedFileName('');
                        setError('');
                      }}
                      className="px-6 py-3 rounded-full border border-white/15 hover:border-white/25 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all w-full sm:w-auto active:scale-95"
                    >
                      {t('practice.tryAgain')}
                    </button>
                    <button
                      onClick={() => setIsChatOpen(true)}
                      className="px-6 py-3 rounded-full bg-[#f99c00] hover:bg-[#f88c00] text-[#0B1120] text-sm font-bold transition-all flex items-center justify-center gap-2 w-full sm:w-auto active:scale-95"
                    >
                      <HugeiconsIcon icon={AiLearningIcon} size={20} strokeWidth={2} />
                      <span>{t('practice.askMaestro')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
        )
      )}

      {/* Floating Chat Toggle Button */}
      {step === 'workboard' && currentScenario && !isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed lg:absolute right-4 bottom-24 lg:bottom-8 z-30 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#f99c00] to-amber-600 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 group"
          aria-label="Open AI Tutor"
          title="Ask Maestro AI for help"
        >
          <HugeiconsIcon icon={AiLearningIcon} size={28} strokeWidth={2} className="group-hover:rotate-6 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0B1120] rounded-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
          </span>
        </button>
      )}

      {/* ChatInterface */}
      {step === 'workboard' && currentScenario && (
        <ChatInterface
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          initialMessage={`Hello! I'm Maestro, your AI study assistant. I see you're working on ${selectedTopicRef?.topicName || 'this topic'}. Feel free to ask me anything — I can explain concepts, give hints, or check your work!`}
        />
      )}

    </div>
  );
}
