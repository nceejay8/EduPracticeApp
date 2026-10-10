import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getAttempt } from '../data/examBank';
import MathText from '../components/MathText';

export default function ExamResults() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const attempt = useMemo(() => getAttempt(attemptId), [attemptId]);
  const [filter, setFilter] = useState('all'); // all | wrong | flagged-not-applicable

  if (!attempt) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
        <div className="text-center">
          <Icon icon="solar:document-text-linear" width="48" className="text-slate-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white mb-2">Result not found</h1>
          <p className="text-slate-400 text-sm mb-4">This exam result could not be loaded.</p>
          <button onClick={() => navigate('/mock-exams')} className="px-5 py-2.5 bg-[#f99c00] text-[#0B1120] rounded-lg font-semibold">
            Back to Mock Exams
          </button>
        </div>
      </div>
    );
  }

  const { percentage, earned, totalMarks, breakdown, topicAccuracy, durationMin, autoSubmitted } = attempt;
  const correctCount = breakdown.filter(b => b.correct).length;
  const wrongCount = breakdown.length - correctCount;

  const grade =
    percentage >= 80 ? { label: 'Excellent', color: 'emerald', icon: 'solar:medal-star-bold' } :
    percentage >= 65 ? { label: 'Good',      color: 'sky',     icon: 'solar:cup-star-bold' } :
    percentage >= 50 ? { label: 'Pass',      color: 'amber',   icon: 'solar:cup-bold' } :
                       { label: 'Needs work',color: 'rose',    icon: 'solar:refresh-circle-bold' };

  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    sky:     'text-sky-400 bg-sky-500/15 border-sky-500/30',
    amber:   'text-amber-400 bg-amber-500/15 border-amber-500/30',
    rose:    'text-rose-400 bg-rose-500/15 border-rose-500/30',
  };

  const visible = filter === 'wrong' ? breakdown.filter(b => !b.correct) : breakdown;

  const handleRetake = () => {
    navigate('/exam/run', {
      state: {
        config: {
          title: attempt.title,
          subtitle: attempt.subtitle,
          kind: attempt.kind,
          subject: attempt.subject,
          level: attempt.level,
          difficulty: attempt.difficulty,
          count: breakdown.length,
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#0B1120]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/mock-exams')} className="text-slate-400 hover:text-white p-2 -ml-2">
            <Icon icon="solar:arrow-left-linear" width="22" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-bold truncate">{attempt.title}</h1>
            <p className="text-xs text-slate-400 truncate">{attempt.subtitle}</p>
          </div>
          <button
            onClick={handleRetake}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] rounded-lg text-sm font-semibold"
          >
            <Icon icon="solar:refresh-circle-linear" width="16" />
            Retake
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Score hero */}
        <section className={`rounded-2xl border p-6 sm:p-8 ${colorMap[grade.color]}`}>
          <div className="flex items-center gap-3 mb-3">
            <Icon icon={grade.icon} width="24" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">{grade.label}</span>
            {autoSubmitted && (
              <span className="ml-auto text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-black/30 text-slate-200">
                Auto-submitted (time up)
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div>
              <p className="text-6xl sm:text-7xl font-bold tabular-nums leading-none">{percentage}<span className="text-3xl sm:text-4xl">%</span></p>
              <p className="text-sm mt-2 opacity-80">{earned} / {totalMarks} marks</p>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 sm:ml-auto text-center">
              <Stat label="Correct" value={correctCount} />
              <Stat label="Wrong" value={wrongCount} />
              <Stat label="Time" value={`${durationMin}m`} />
            </div>
          </div>
        </section>

        {/* Topic breakdown */}
        {topicAccuracy.length > 0 && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-4">Per-topic accuracy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topicAccuracy.map(t => (
                <div key={t.topic} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white truncate">{t.topic}</p>
                    <span className="text-xs text-slate-400 tabular-nums">{t.correct}/{t.total}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        t.accuracy >= 80 ? 'bg-emerald-500' :
                        t.accuracy >= 50 ? 'bg-[#f99c00]' : 'bg-rose-500'
                      }`}
                      style={{ width: `${t.accuracy}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 tabular-nums">{t.accuracy}%</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Question review */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold">Review questions</h2>
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 text-xs sm:text-sm">
              {[
                { v: 'all', label: `All (${breakdown.length})` },
                { v: 'wrong', label: `Wrong (${wrongCount})` },
              ].map(o => (
                <button
                  key={o.v}
                  onClick={() => setFilter(o.v)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    filter === o.v ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {visible.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8 bg-white/5 rounded-xl border border-white/5">
                Nothing to show here. Great work!
              </p>
            )}
            {visible.map((b, idx) => {
              const indexInExam = breakdown.indexOf(b) + 1;
              const userText = b.userAnswer === null || b.userAnswer === '' || b.userAnswer === undefined
                ? 'No answer'
                : String(b.userAnswer);
              return (
                <details
                  key={b.id}
                  className={`group bg-white/5 border rounded-xl ${
                    b.correct ? 'border-emerald-500/20' : 'border-rose-500/20'
                  }`}
                  open={!b.correct && idx < 3}
                >
                  <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-start gap-3">
                    <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                      b.correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {indexInExam}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 mb-1">{b.topic} • {b.difficulty}</p>
                      <p className="text-sm sm:text-base text-white leading-relaxed"><MathText text={b.prompt} /></p>
                    </div>
                    <Icon
                      icon={b.correct ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                      width="22"
                      className={`shrink-0 ${b.correct ? 'text-emerald-400' : 'text-rose-400'}`}
                    />
                  </summary>
                  <div className="px-4 sm:px-5 pb-5 pt-0 space-y-2 text-sm">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <p className="text-slate-400">
                        Your answer: <MathText className={b.correct ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'} text={userText} />
                      </p>
                      <p className="text-slate-400">
                        Correct: <MathText className="text-emerald-300 font-semibold" text={String(b.correctAnswer)} />
                      </p>
                    </div>
                    {b.explanation && (
                      <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/5">
                        <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Explanation</p>
                        <p className="text-slate-200 leading-relaxed"><MathText text={b.explanation} /></p>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => navigate('/mock-exams')}
            className="flex-1 px-5 py-3 rounded-xl border border-white/10 text-slate-200 font-semibold hover:bg-white/5"
          >
            Back to Mock Exams
          </button>
          <button
            onClick={handleRetake}
            className="flex-1 px-5 py-3 rounded-xl bg-[#f99c00] hover:bg-[#f99c00]/90 text-[#0B1120] font-semibold flex items-center justify-center gap-2"
          >
            <Icon icon="solar:refresh-circle-linear" width="18" />
            Retake exam
          </button>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-black/20 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-xl sm:text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}
