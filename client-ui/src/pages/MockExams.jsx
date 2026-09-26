import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { listAttempts, SUBJECTS, questionBank } from '../data/examBank';
import { buildTopicExams } from '../data/topicExams';
import { normalizeSubject, normalizeLevelId } from '../data/syllabus';
import { EmptyState, Modal, Pill, subjectIcon } from '../components/ui';
import { clearExamDraft, loadExamDraft } from '../services/examDraftService';

// Map our level ids to the labels stored on questions/topics.
const LEVELS = [
  { id: 'A-Level', name: 'A-Level',        short: 'A-Level', description: 'Advanced Level (S.6)',          topicsKey: 'ALEVEL' },
  { id: 'UACE',    name: 'UACE',           short: 'UACE',    description: 'Uganda Advanced Certificate of Education', topicsKey: 'ALEVEL' },
];

// Pre-defined mock exams. Each one mixes scenario-based questions with MCQs/numerics.
// `scenarioCount` reserves N slots for Uganda-context scenario questions.
const MOCK_EXAMS = [
  {
    id: 'mock-physics-al', title: 'Physics — A-Level Mock',
    subject: 'Physics', level: 'A-Level', difficulty: 'Hard',
    duration: '2h', count: 10, scenarioCount: 2,
    icon: 'solar:atom-bold', tone: 'sky',
    description: 'Classical mechanics, optics and modern physics with applied scenarios.'
  },
  {
    id: 'mock-math-al', title: 'Mathematics — A-Level Mock',
    subject: 'Mathematics', level: 'A-Level', difficulty: 'Hard',
    duration: '2h', count: 10, scenarioCount: 2,
    icon: 'solar:calculator-bold', tone: 'violet',
    description: 'Pure and applied mathematics, statistics and probability with applied scenarios.'
  },
];

const TONE = {
  sky:     'from-sky-500/15 to-sky-500/5 border-sky-500/30 text-sky-300',
  violet:  'from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-300',
};

export default function MockExams() {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeDraft = useMemo(() => loadExamDraft(), []);

  // /mock-exams?level=uace&subject=physics&topic=phy-mech-energy
  // Arriving from a topic on /syllabus. Seeded from the URL so the right level is
  // already selected and the target paper can be confirmed straight away, rather
  // than dumping the student on a list they then have to hunt through.
  const [selectedLevel, setSelectedLevel] = useState(
    () => normalizeLevelId(searchParams.get('level')) || 'A-Level'
  );
  const [showAllMocks, setShowAllMocks] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [confirmExam, setConfirmExam] = useState(null);
  const [customExam, setCustomExam] = useState({
    subject: 'Physics',
    level: 'A-Level',
    difficulty: 'Medium',
    count: 10,
  });

  // Mock exams filtered by level
  const visibleMocks = useMemo(
    () => MOCK_EXAMS.filter(e => e.level === selectedLevel),
    [selectedLevel]
  );

  // Topic exams come from the coverage map, so this list and the syllabus page
  // can never disagree about which topics have a paper.
  const topicExams = useMemo(() => buildTopicExams(selectedLevel), [selectedLevel]);

  // The paper the student asked for, if they arrived with a topic in the URL.
  const requestedTopic = useMemo(() => {
    const subjectId = normalizeSubject(searchParams.get('subject'));
    const topicId = searchParams.get('topic');
    if (!subjectId || !topicId) return null;
    return topicExams.find(e => e.subjectId === subjectId && e.topicId === topicId) || null;
  }, [searchParams, topicExams]);

  useEffect(() => {
    if (requestedTopic) setConfirmExam(requestedTopic);
  }, [requestedTopic]);

  // Recent attempts pulled from localStorage
  const recent = useMemo(() => listAttempts().slice(0, 5), []);

  // How many real questions exist per subject (used to show capacity in the builder)
  const subjectCounts = useMemo(() => {
    const counts = {};
    SUBJECTS.forEach(s => { counts[s] = questionBank.filter(q => q.subject === s).length; });
    return counts;
  }, []);

  const startExam = (exam) => {
    setConfirmExam(null);
    navigate('/exam/run', {
      state: {
        config: {
          title: exam.title,
          subtitle: `${exam.level} • ${exam.subject || 'Mixed'} • ${exam.difficulty}`,
          kind: exam.kind || 'mock',
          subject: exam.subject || null,
          level: exam.level,
          difficulty: exam.difficulty,
          count: exam.count,
          duration: exam.duration,
          topics: exam.topics || null,
          topicId: exam.topicId || null,
          scenarioCount: exam.scenarioCount || 0,
        }
      }
    });
  };

  const handleBuildCustom = () => {
    if (!customExam.subject || !customExam.difficulty || !customExam.count) return;
    startExam({
      title: `Custom ${customExam.subject} Exam`,
      subject: customExam.subject,
      level: customExam.level,
      difficulty: customExam.difficulty,
      count: parseInt(customExam.count, 10),
      duration: `${Math.max(5, parseInt(customExam.count, 10) * 2)}m`,
      kind: 'custom',
    });
  };

  return (
    <>
      <div className="w-full bg-[#0B1120]">
        {/* Hero */}
        <div className="bg-gradient-to-r from-[#f99c00]/20 to-[#f99c00]/5 px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12 border-b border-white/5">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">{t('nav.mockExams')}</h1>
            <p className="text-slate-300 text-sm sm:text-base md:text-lg max-w-2xl">
              Take full-length mock exams or focused topic exams. Every question is graded with explanations so you know exactly where to improve.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12">
          <div className="max-w-6xl mx-auto space-y-12 sm:space-y-14">

            {/* Level selector */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Select your level</h2>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Showing exams for <span className="text-white font-semibold">{selectedLevel}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                {LEVELS.map(level => {
                  const active = selectedLevel === level.id;
                  const mockCount = MOCK_EXAMS.filter(e => e.level === level.id).length;
                  return (
                    <button
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className={`p-5 md:p-6 rounded-2xl border-2 text-left transition-all group ${
                        active
                          ? 'bg-[#f99c00]/10 border-[#f99c00]'
                          : 'bg-white/5 border-white/10 hover:border-[#f99c00]/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                          active ? 'bg-[#f99c00] text-[#0B1120]' : 'bg-white/10 text-slate-300'
                        }`}>
                          <Icon icon="solar:square-academic-cap-bold" width="22" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{level.name}</h3>
                          <p className="text-xs text-slate-400">{mockCount} mock exam{mockCount === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-400">{level.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Recent attempts */}
            {activeDraft?.exam && (
              <section>
                <div className="bg-[#111827] border border-[#f99c00]/25 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider font-semibold text-[#f99c00] mb-1">Resume exam</p>
                    <h2 className="text-lg sm:text-xl font-bold text-white truncate">{activeDraft.exam.title}</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Question {(activeDraft.current || 0) + 1} of {activeDraft.exam.questions.length}
                      {' • '}
                      {Math.ceil((activeDraft.secondsLeft || 0) / 60)} minutes remaining
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigate('/exam/run')}
                      className="px-5 py-3 bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] rounded-lg font-semibold"
                    >
                      Resume now
                    </button>
                    <button
                      onClick={() => {
                        clearExamDraft();
                        setConfirmExam(null);
                        window.location.href = window.location.href;
                      }}
                      className="px-5 py-3 border border-white/10 text-slate-300 rounded-lg font-semibold hover:bg-white/5"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-5">Recent attempts</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recent.map(a => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/exam/results/${a.id}`)}
                      className="text-left bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#f99c00]/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 truncate pr-2">{a.subtitle}</span>
                        <span className={`text-2xl font-bold tabular-nums ${
                          a.percentage >= 80 ? 'text-emerald-400' :
                          a.percentage >= 50 ? 'text-[#f99c00]' : 'text-rose-400'
                        }`}>{a.percentage}%</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(a.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' • '}{a.durationMin}m
                        {' • '}{a.earned}/{a.totalMarks} marks
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Mock exams */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Mock exams</h2>
                  <p className="text-sm text-slate-400 mt-1">Full-length papers timed like the real thing.</p>
                </div>
                {visibleMocks.length > 3 && (
                  <button
                    onClick={() => setShowAllMocks(s => !s)}
                    className="text-[#f99c00] hover:text-[#f99c00]/80 font-medium text-sm whitespace-nowrap"
                  >
                    {showAllMocks ? '← Show less' : 'View all →'}
                  </button>
                )}
              </div>

              {visibleMocks.length === 0 ? (
                <EmptyState
                  title="No mock exams for this level yet"
                  hint="Try a different level, or build a custom exam below."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {(showAllMocks ? visibleMocks : visibleMocks.slice(0, 4)).map(exam => (
                    <article
                      key={exam.id}
                      className={`rounded-2xl p-5 sm:p-6 border bg-gradient-to-br ${TONE[exam.tone] || TONE.sky} hover:scale-[1.01] transition-all`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-black/30 flex items-center justify-center shrink-0">
                          <Icon icon={exam.icon} width="22" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-white">{exam.title}</h3>
                          <p className="text-xs text-slate-300/80 mt-1 line-clamp-2">{exam.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300 mb-5">
                        <Pill icon="solar:clock-circle-linear">{exam.duration}</Pill>
                        <Pill icon="solar:checklist-minimalistic-linear">{exam.count} questions</Pill>
                        <Pill icon="solar:graph-up-linear">{exam.difficulty}</Pill>
                        {exam.scenarioCount > 0 && (
                          <Pill icon="solar:map-point-wave-linear">{exam.scenarioCount} scenarios</Pill>
                        )}
                      </div>
                      <button
                        onClick={() => setConfirmExam(exam)}
                        className="w-full px-4 py-2.5 bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <Icon icon="solar:play-circle-bold" width="18" />
                        Start mock
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Topic / Other exams */}
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Topic exams</h2>
                  <p className="text-sm text-slate-400 mt-1">Shorter, focused exams generated from each topic in the syllabus.</p>
                </div>
                <Link
                  to="/syllabus"
                  className="text-sm text-[#f99c00] hover:underline flex items-center gap-1.5"
                >
                  <Icon icon="solar:layers-linear" width="16" />
                  Browse the full syllabus
                </Link>
              </div>

              {topicExams.length === 0 ? (
                <EmptyState
                  title="No topic exams available for this level"
                  hint="Switch to A-Level or UACE, or use the custom builder below."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topicExams.map(exam => (
                    <div
                      key={exam.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-[#f99c00]/40 transition-all flex flex-col"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-slate-200">
                          <Icon icon={subjectIcon(exam.subject)} width="20" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400 truncate">{exam.chapterName}</p>
                          <h3 className="text-sm font-bold text-white truncate">{exam.topicName}</h3>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                        {exam.subtopics?.length ? `Covers: ${exam.subtopics.slice(0, 3).join(', ')}${exam.subtopics.length > 3 ? '…' : ''}` : '—'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                        <span className="flex items-center gap-1"><Icon icon="solar:checklist-minimalistic-linear" width="14" /> {exam.count} Qs</span>
                        <span className="flex items-center gap-1"><Icon icon="solar:clock-circle-linear" width="14" /> {exam.duration}</span>
                        <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          exam.difficulty === 'Easy' ? 'bg-emerald-500/15 text-emerald-300' :
                          exam.difficulty === 'Medium' ? 'bg-[#f99c00]/15 text-[#f99c00]' :
                          'bg-rose-500/15 text-rose-300'
                        }`}>{exam.difficulty}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-auto">
                        <button
                          onClick={() => startExam(exam)}
                          className="flex-1 px-4 py-2 border border-[#f99c00]/40 hover:bg-[#f99c00]/10 text-[#f99c00] rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:play-circle-linear" width="16" />
                          Start
                        </button>
                        <Link
                          to={`/syllabus?level=${encodeURIComponent(exam.level)}&subject=${exam.subjectId}&topic=${encodeURIComponent(exam.topicId)}`}
                          title="Open in syllabus"
                          className="px-2.5 py-2 border border-white/10 hover:border-white/25 text-slate-300 hover:text-white rounded-lg text-sm flex items-center justify-center"
                        >
                          <Icon icon="solar:layers-linear" width="16" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Custom builder */}
            <section className="bg-gradient-to-br from-[#f99c00]/10 to-[#f99c00]/5 border border-[#f99c00]/20 rounded-2xl p-6 sm:p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Build your own exam</h3>
                  <p className="text-sm text-slate-300 max-w-xl">
                    Choose subject, difficulty and length. We’ll pull real questions from the bank and time you accordingly.
                  </p>
                </div>
                <button
                  onClick={() => setShowCustomBuilder(true)}
                  className="px-6 py-3 bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] rounded-lg font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Icon icon="solar:settings-linear" width="18" />
                  Configure custom exam
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Confirm-start modal for mock exams */}
      {confirmExam && (
        <Modal onClose={() => setConfirmExam(null)} title="Ready to start?">
          <div className="bg-white/5 rounded-lg p-4 mb-5 space-y-3">
            <Field label="Exam">{confirmExam.title}</Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Duration">{confirmExam.duration}</Field>
              <Field label="Questions">{confirmExam.count}</Field>
              <Field label="Difficulty">{confirmExam.difficulty}</Field>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Once started, the timer begins. Your answers are auto-saved if you accidentally close this tab.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmExam(null)}
              className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-lg font-semibold hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={() => startExam(confirmExam)}
              className="flex-1 px-4 py-2.5 bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Icon icon="solar:play-circle-bold" width="18" />
              Start now
            </button>
          </div>
        </Modal>
      )}

      {/* Custom builder modal */}
      {showCustomBuilder && (
        <Modal onClose={() => setShowCustomBuilder(false)} title="Build a custom exam">
          <div className="space-y-4 mb-6">
            <Select
              label="Subject"
              value={customExam.subject}
              onChange={v => setCustomExam(c => ({ ...c, subject: v }))}
              options={SUBJECTS.map(s => ({ value: s, label: `${s} (${subjectCounts[s] || 0} questions)` }))}
            />
            <Select
              label="Level"
              value={customExam.level}
              onChange={v => setCustomExam(c => ({ ...c, level: v }))}
              options={LEVELS.map(l => ({ value: l.id, label: l.name }))}
            />
            <Select
              label="Difficulty"
              value={customExam.difficulty}
              onChange={v => setCustomExam(c => ({ ...c, difficulty: v }))}
              options={[
                { value: 'Easy', label: 'Easy' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Hard', label: 'Hard' },
              ]}
            />
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Number of questions: {customExam.count}</label>
              <input
                type="range"
                min="5" max="20" step="1"
                value={customExam.count}
                onChange={e => setCustomExam(c => ({ ...c, count: parseInt(e.target.value, 10) }))}
                className="w-full accent-[#f99c00]"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>5</span><span>20</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 bg-white/5 rounded-lg p-3 border border-white/5">
              <Icon icon="solar:info-circle-linear" width="14" className="inline mr-1 align-text-top" />
              We try to match your filters exactly. If we can’t find enough questions, we’ll widen the search rather than show empty slots.
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCustomBuilder(false)}
              className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-lg font-semibold hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleBuildCustom}
              className="flex-1 px-4 py-2.5 bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Icon icon="solar:play-circle-bold" width="18" />
              Start exam
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ----------------- helpers & small components ----------------- */

// Topic exams, generated from the canonical syllabus outline.
//
// Matching is alias-aware: the question bank tags itself with legacy free-text
// topic strings ('Classical Mechanics', 'Gas Laws', 'Energy & Power') that do
// not match the official outline names, so each question is resolved onto the
// syllabus first and then matched. Both the regular bank and the Uganda-context
// scenario bank are searched — the scenario questions are a meaningful part of
// a topic paper and were previously being ignored here.
function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-white font-semibold text-sm">{children}</p>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#f99c00]/50"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-[#111827]">{o.label}</option>
        ))}
      </select>
    </div>
  );
}
