import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { buildExam, scoreExam, saveAttempt } from '../data/examBank';
import { trackExamStart, trackExamCompletion } from '../utils/analyticsTracker';
import FocusAudio from '../components/FocusAudio';
import MathText from '../components/MathText';
import { clearExamDraft, loadExamDraft, saveExamDraft } from '../services/examDraftService';
import { useAuth } from '../contexts/AuthContext';

function parseDurationToSeconds(str) {
  if (!str) return 30 * 60;
  if (typeof str === 'number') return str * 60;
  const s = String(str).toLowerCase();
  let total = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  return total > 0 ? total : 30 * 60;
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExamRunner() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const incomingConfig = location.state?.config;
  const existingDraft = useMemo(() => loadExamDraft(), []);
  const config = incomingConfig || existingDraft?.config || null;

  // Build the question set once on mount, based on the incoming config.
  const exam = useMemo(() => {
    if (!config) return null;
    if (!incomingConfig && existingDraft?.exam) {
      return existingDraft.exam;
    }
    const questions = buildExam({
      subject: config.subject,
      level: config.level,
      difficulty: config.difficulty,
      count: config.count || 10,
      topics: config.topics || null,
      topicId: config.topicId || null,
      scenarioCount: config.scenarioCount || 0,
    });
    return {
      title: config.title || `${config.subject || 'Mixed'} Practice`,
      subtitle: config.subtitle || `${config.level || 'All levels'} • ${config.difficulty || 'Mixed'}`,
      kind: config.kind || 'topic', // 'mock' | 'topic' | 'custom'
      durationSec: parseDurationToSeconds(config.duration ?? config.count * 90),
      questions,
    };
  }, [config, incomingConfig, existingDraft]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(exam?.durationSec || 0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const startedAtRef = useRef(Date.now());

  // Restore draft if user refreshes mid-exam.
  useEffect(() => {
    if (!exam) return;
    const draft = loadExamDraft();
    if (draft && draft.exam?.title === exam.title) {
      setAnswers(draft.answers || {});
      setFlagged(draft.flagged || {});
      if (typeof draft.secondsLeft === 'number') setSecondsLeft(draft.secondsLeft);
      if (typeof draft.current === 'number') setCurrent(draft.current);
      startedAtRef.current = draft.startedAt || Date.now();
      return;
    }
    setSecondsLeft(exam.durationSec);
    startedAtRef.current = Date.now();
    trackExamStart(exam.title, config?.level || 'mixed');
  }, [exam, config]);

  // Persist draft whenever state changes.
  useEffect(() => {
    if (!exam) return;
    saveExamDraft({
      config,
      exam,
      answers, flagged, secondsLeft, current,
      startedAt: startedAtRef.current,
    });
  }, [exam, config, answers, flagged, secondsLeft, current]);

  // Countdown timer
  useEffect(() => {
    if (!exam || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]);

  if (!config || !exam) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Icon icon="solar:document-text-linear" width="48" className="text-slate-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white mb-2">No exam selected</h1>
          <p className="text-slate-400 text-sm mb-4">Pick an exam from the Mock Exams page to begin.</p>
          <button
            onClick={() => navigate('/mock-exams')}
            className="px-5 py-2.5 bg-[#f99c00] text-[#0B1120] rounded-lg font-semibold"
          >
            Back to Mock Exams
          </button>
        </div>
      </div>
    );
  }

  if (exam.questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold text-white mb-2">No questions found</h1>
          <p className="text-slate-400 text-sm mb-4">We couldn’t find questions matching that selection. Try a different subject or level.</p>
          <button
            onClick={() => navigate('/mock-exams')}
            className="px-5 py-2.5 bg-[#f99c00] text-[#0B1120] rounded-lg font-semibold"
          >
            Back to Mock Exams
          </button>
        </div>
      </div>
    );
  }

  const q = exam.questions[current];
  const answeredCount = Object.values(answers).filter(v => v !== undefined && v !== null && v !== '').length;
  const progress = Math.round(((current + 1) / exam.questions.length) * 100);
  const lowTime = secondsLeft <= 60;

  const setAnswer = (val) => setAnswers(prev => ({ ...prev, [q.id]: val }));
  const toggleFlag = () => setFlagged(prev => ({ ...prev, [q.id]: !prev[q.id] }));

  const goPrev = () => setCurrent(c => Math.max(0, c - 1));
  const goNext = () => setCurrent(c => Math.min(exam.questions.length - 1, c + 1));

  function handleSubmit(auto = false) {
    const result = scoreExam(exam.questions, answers);
    const durationMin = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    const id = `att_${Date.now()}`;
    const attempt = {
      id,
      title: exam.title,
      subtitle: exam.subtitle,
      kind: exam.kind,
      level: config.level || null,
      subject: config.subject || null,
      difficulty: config.difficulty || null,
      questions: exam.questions,
      answers,
      ...result,
      durationMin,
      autoSubmitted: auto,
      submittedAt: new Date().toISOString(),
    };
    saveAttempt(attempt, auth.user?.id);
    trackExamCompletion(exam.title, result.percentage, durationMin);
    clearExamDraft();
    navigate(`/exam/results/${id}`, { replace: true });
  }

  const handleAbandon = () => setShowAbandonModal(true);

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#0B1120]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={handleAbandon}
            className="text-slate-400 hover:text-white p-2 -ml-2"
            aria-label="Exit exam"
          >
            <Icon icon="solar:arrow-left-linear" width="22" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold truncate">{exam.title}</h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <Icon icon="solar:bolt-linear" width="10" />
                Focus mode
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{exam.subtitle}</p>
          </div>
          <FocusAudio />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold tabular-nums ${
            lowTime
              ? 'bg-red-500/15 border-red-500/30 text-red-300 animate-pulse'
              : 'bg-white/5 border-white/10 text-white'
          }`}>
            <Icon icon="solar:clock-circle-linear" width="16" />
            {formatTime(secondsLeft)}
          </div>
        </div>
        {/* Progress strip */}
        <div className="h-1 bg-white/5">
          <div className="h-full bg-[#f99c00] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs sm:text-sm text-slate-400">
              Question <span className="text-white font-semibold">{current + 1}</span> of {exam.questions.length}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                q.difficulty === 'Easy'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : q.difficulty === 'Medium'
                  ? 'bg-[#f99c00]/20 text-[#f99c00]'
                  : 'bg-red-500/20 text-red-300'
              }`}>{q.difficulty}</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                {q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-7">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-slate-400">{q.topic}</p>
              {q.context && (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Scenario
                </span>
              )}
            </div>

            {q.context && (
              <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:map-point-wave-linear" width="20" className="text-amber-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-300 mb-1.5">
                      Read the scenario
                    </p>
                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed"><MathText text={q.context} /></p>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-lg sm:text-xl font-semibold leading-relaxed mb-6"><MathText text={q.prompt} /></h2>

            {q.type === 'mcq' && (
              <div className="space-y-2.5">
                {q.options.map((opt, i) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswer(opt)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${
                        selected
                          ? 'bg-[#f99c00]/15 border-[#f99c00] text-white'
                          : 'bg-white/5 border-white/10 hover:border-white/30 text-slate-200'
                      }`}
                    >
                      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold ${
                        selected ? 'bg-[#f99c00] text-[#0B1120]' : 'bg-white/10 text-slate-300'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <MathText className="flex-1 text-sm sm:text-base" text={opt} />
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'numeric' && (
              <div>
                <label className="block text-sm text-slate-300 mb-2">Your answer (number)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#f99c00]/50"
                  placeholder="Enter a number"
                />
                <p className="text-xs text-slate-500 mt-2">Enter the numeric value only — units are not required.</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
              <button
                onClick={toggleFlag}
                className={`text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  flagged[q.id]
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-transparent border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                }`}
              >
                <Icon icon={flagged[q.id] ? 'solar:flag-bold' : 'solar:flag-linear'} width="16" />
                {flagged[q.id] ? 'Flagged' : 'Flag for review'}
              </button>
              <button
                onClick={() => setShowOverview(true)}
                className="text-sm text-slate-400 hover:text-white flex items-center gap-2 px-3 py-1.5"
              >
                <Icon icon="solar:list-linear" width="16" />
                Overview
              </button>
            </div>
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={goPrev}
              disabled={current === 0}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-white/10 text-slate-200 font-semibold disabled:opacity-40 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Icon icon="solar:arrow-left-linear" width="18" />
              Previous
            </button>
            {current < exam.questions.length - 1 ? (
              <button
                onClick={goNext}
                className="flex-1 sm:flex-none ml-auto px-6 py-3 rounded-xl bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] font-semibold transition-all flex items-center justify-center gap-2"
              >
                Next
                <Icon icon="solar:arrow-right-linear" width="18" />
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex-1 sm:flex-none ml-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-500/90 text-[#0B1120] font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Icon icon="solar:check-circle-bold" width="18" />
                Submit Exam
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center">
            {answeredCount} of {exam.questions.length} answered
            {Object.values(flagged).filter(Boolean).length > 0 &&
              ` • ${Object.values(flagged).filter(Boolean).length} flagged`}
          </p>
        </div>
      </main>

      {/* Overview Modal */}
      {showOverview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111827] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[85vh] overflow-y-auto border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Question overview</h3>
              <button onClick={() => setShowOverview(false)} className="text-slate-400 hover:text-white">
                <Icon icon="solar:close-circle-linear" width="22" />
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mb-5">
              {exam.questions.map((qq, idx) => {
                const ans = answers[qq.id];
                const isAnswered = ans !== undefined && ans !== null && ans !== '';
                const isFlagged = flagged[qq.id];
                const isCurrent = idx === current;
                return (
                  <button
                    key={qq.id}
                    onClick={() => { setCurrent(idx); setShowOverview(false); }}
                    className={`aspect-square rounded-lg text-sm font-semibold border transition-all flex items-center justify-center relative ${
                      isCurrent
                        ? 'border-[#f99c00] bg-[#f99c00]/15 text-white'
                        : isAnswered
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#111827]" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-4">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/40" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/20" /> Unanswered</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Flagged</span>
            </div>
            <button
              onClick={() => { setShowOverview(false); setShowSubmitModal(true); }}
              className="w-full px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-500/90 text-[#0B1120] font-semibold"
            >
              Submit exam
            </button>
          </div>
        </div>
      )}

      {/* Abandon confirm modal */}
      {showAbandonModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111827] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Icon icon="solar:exit-linear" width="20" className="text-amber-400" />
              </div>
              <h3 className="text-xl font-bold">Leave this exam?</h3>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              Your progress has been auto-saved. You can resume from where you left off by returning to Mock Exams.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAbandonModal(false)}
                className="flex-1 px-4 py-2.5 border border-white/10 text-slate-200 rounded-lg font-semibold hover:bg-white/5 transition-all"
              >
                Keep going
              </button>
              <button
                onClick={() => { setShowAbandonModal(false); navigate('/mock-exams'); }}
                className="flex-1 px-4 py-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg font-semibold hover:bg-amber-500/25 transition-all"
              >
                Leave exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirm modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111827] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-white/10">
            <h3 className="text-xl font-bold mb-2">Submit exam?</h3>
            <p className="text-sm text-slate-400 mb-5">
              You answered {answeredCount} of {exam.questions.length} questions.
              {answeredCount < exam.questions.length && ' Unanswered questions will be marked incorrect.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-2.5 border border-white/10 text-slate-200 rounded-lg font-semibold hover:bg-white/5"
              >
                Keep going
              </button>
              <button
                onClick={() => handleSubmit(false)}
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-500/90 text-[#0B1120] rounded-lg font-semibold"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
