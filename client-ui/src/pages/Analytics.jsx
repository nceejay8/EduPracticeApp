import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { formatStudyTime } from '../data/examBank';
import useAnalyticsData from '../hooks/useAnalyticsData';

const PERIODS = [
  { value: '7',   label: 'Last 7 days',  days: 7 },
  { value: '30',  label: 'Last 30 days', days: 30 },
  { value: '90',  label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time',     days: null },
];

const SUBJECT_COLORS = {
  Physics:     { dot: 'bg-blue-500', bar: 'from-blue-500 to-blue-400',  hover: 'border-blue-500/20' },
  Mathematics: { dot: 'bg-rose-500', bar: 'from-rose-500 to-rose-400',  hover: 'border-rose-500/20' },
};

export default function Analytics() {
  const { t } = useLocalization();
  const [period, setPeriod] = useState('7');
  const days = PERIODS.find(p => p.value === period)?.days ?? null;

  const { data, loading, source, refresh } = useAnalyticsData({ days });
  const hasAny = data.totalAttempts > 0;

  const peakWeekly = Math.max(1, ...data.weeklyActivity.map(d => d.questions));

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-4 sm:p-6 md:p-8 bg-[#0B1120]">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">{t('nav.analytics')}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-slate-400">Metrics calculated from your actual exam attempts.</p>
              {/* Three states, not two. 'merged' means some attempts are still
                  server-side pending (taken offline), so calling that "Local
                  storage" would misdescribe data that is mostly synced. */}
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                source === 'supabase'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : source === 'merged'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-white/5 text-slate-500 border border-white/10'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  source === 'supabase'
                    ? 'bg-emerald-400 animate-pulse'
                    : source === 'merged'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500'
                }`} />
                {source === 'supabase'
                  ? 'Live · Supabase'
                  : source === 'merged'
                    ? 'Syncing offline results'
                    : 'Local storage'}
              </span>
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Icon icon="solar:refresh-linear" width="12" className={loading ? 'animate-spin' : ''} />
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full sm:w-auto bg-white/5 border border-white/10 hover:border-white/20 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f99c00]/50 appearance-none transition-all min-h-[44px] sm:min-h-[40px]"
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {!hasAny && <EmptyAnalyticsBanner />}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <MetricCard
            icon="solar:checklist-minimalistic-linear"
            tone="blue"
            label="Questions Answered"
            value={data.totalQuestions}
            badge={data.improvement !== 0
              ? { text: `${data.improvement > 0 ? '+' : ''}${data.improvement}%`, tone: data.improvement >= 0 ? 'good' : 'bad' }
              : null}
          />
          <MetricCard
            icon="solar:target-linear"
            tone="purple"
            label="Average Score"
            value={`${data.avgScore}%`}
            badge={hasAny ? { text: `${data.totalAttempts} exam${data.totalAttempts === 1 ? '' : 's'}`, tone: 'muted' } : null}
          />
          <MetricCard
            icon="solar:clock-circle-linear"
            tone="rose"
            label="Study Time"
            value={formatStudyTime(data.studyMinutes)}
            badge={{ text: PERIODS.find(p => p.value === period)?.label, tone: 'muted' }}
          />
          <MetricCard
            icon="solar:cup-star-linear"
            tone="amber"
            label="Overall Accuracy"
            value={`${data.accuracyOverall}%`}
            badge={data.accuracyOverall >= 80
              ? { text: 'Strong', tone: 'good' }
              : data.accuracyOverall >= 60 ? { text: 'Building', tone: 'muted' }
              : hasAny ? { text: 'Needs work', tone: 'bad' } : null}
          />
        </div>

        {/* Subject Performance — Physics & Mathematics only */}
        <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-5 sm:p-6 md:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-6">Subject Performance</h3>

          <div className="space-y-5 sm:space-y-6">
            {data.subjectPerformance.map(s => {
              const c = SUBJECT_COLORS[s.subject] || SUBJECT_COLORS.Physics;
              return (
                <div key={s.subject} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                      {s.subject}
                      <span className="text-xs text-slate-500 ml-1">
                        {s.total > 0
                          ? `${s.correct}/${s.total} correct • ${s.attempts} exam${s.attempts === 1 ? '' : 's'}`
                          : 'No data yet'}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-white">{s.mastery}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${c.bar} rounded-full transition-all`}
                      style={{ width: `${s.mastery}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-5 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">Weekly Activity</h3>
              <p className="text-xs text-slate-400 mt-1">Questions answered each day for the last 7 days.</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-40">
            {data.weeklyActivity.map((d, i) => {
              const heightPct = d.questions > 0 ? Math.max(8, Math.round((d.questions / peakWeekly) * 100)) : 4;
              return (
                <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group relative">
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#2a3441] text-white text-[10px] font-medium px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                    {d.questions} Q · {d.minutes}m
                  </div>
                  <div
                    className={`w-full rounded-lg transition-all ${
                      d.questions > 0
                        ? 'bg-gradient-to-t from-[#f99c00] to-[#f99c00]/70 hover:to-[#f99c00]'
                        : 'bg-white/5'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[11px] font-medium text-slate-500">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streaks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <StreakCard
            icon="solar:fire-bold"
            label="Current Streak"
            value={`${data.streak} ${data.streak === 1 ? 'Day' : 'Days'}`}
            sub={data.streak > 0 ? "Keep it up — don't break the streak." : 'Take an exam today to start a streak.'}
            color="text-[#f99c00]"
            border="hover:border-[#f99c00]/20"
          />
          <StreakCard
            icon="solar:cup-star-bold"
            label="Longest Streak"
            value={`${data.longestStreak} ${data.longestStreak === 1 ? 'Day' : 'Days'}`}
            sub={data.longestStreak > 0 ? 'Your best record so far.' : 'No streaks yet.'}
            color="text-emerald-400"
            border="hover:border-emerald-500/20"
          />
        </div>

        {/* Recent attempts */}
        <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-5 sm:p-6 md:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-5">Recent attempts</h3>
          {data.attempts.length === 0 ? (
            <p className="text-sm text-slate-400">
              No attempts in this period yet.{' '}
              <Link to="/mock-exams" className="text-[#f99c00] hover:underline">Take an exam</Link>
              {' '}to see analytics here.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {data.attempts.slice(0, 8).map(a => (
                <Link
                  key={a.id}
                  to={`/exam/results/${a.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-slate-200 shrink-0">
                    <Icon icon={a.subject === 'Mathematics' ? 'solar:calculator-bold' : 'solar:atom-bold'} width="18" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">
                      {a.subject} • {a.level} • {a.breakdown?.length || 0} questions • {formatStudyTime(a.durationMin)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${
                      a.percentage >= 80 ? 'text-emerald-400' :
                      a.percentage >= 60 ? 'text-[#f99c00]' :
                      'text-rose-400'
                    }`}>{a.percentage}%</p>
                    <p className="text-[11px] text-slate-500">{relativeTime(a.submittedAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function EmptyAnalyticsBanner() {
  return (
    <div className="rounded-2xl border border-[#f99c00]/30 bg-gradient-to-r from-[#f99c00]/10 to-[#f99c00]/5 p-5 sm:p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-[#f99c00]/20 flex items-center justify-center text-[#f99c00] shrink-0">
        <Icon icon="solar:graph-up-linear" width="24" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white">No exam data yet</h3>
        <p className="text-xs text-slate-300 mt-0.5">
          Once you complete a mock or topic exam, your scores, accuracy and streaks will appear here automatically.
        </p>
      </div>
      <Link
        to="/mock-exams"
        className="hidden sm:inline-flex px-4 py-2 bg-[#f99c00] text-[#0B1120] rounded-lg text-sm font-semibold whitespace-nowrap"
      >
        Take an exam
      </Link>
    </div>
  );
}

function MetricCard({ icon, tone, label, value, badge }) {
  const tones = {
    blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'hover:border-blue-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'hover:border-purple-500/20' },
    rose:   { bg: 'bg-rose-500/10',   text: 'text-rose-400',   border: 'hover:border-rose-500/20' },
    amber:  { bg: 'bg-[#f99c00]/10',  text: 'text-[#f99c00]',  border: 'hover:border-[#f99c00]/20' },
  };
  const c = tones[tone] || tones.blue;
  const badgeClass = badge?.tone === 'good'
    ? 'text-emerald-400 bg-emerald-400/10'
    : badge?.tone === 'bad'
      ? 'text-rose-300 bg-rose-500/10'
      : 'text-slate-400 bg-white/5';
  return (
    <div className={`bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-5 sm:p-6 ${c.border} transition-all group`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg ${c.bg} flex items-center justify-center ${c.text} group-hover:scale-110 transition-transform`}>
          <Icon icon={icon} width="24" style={{ strokeWidth: 1 }} />
        </div>
        {badge && (
          <span className={`text-xs font-medium ${badgeClass} px-2.5 py-1 rounded-full`}>{badge.text}</span>
        )}
      </div>
      <p className="text-xs sm:text-sm text-slate-400 mb-2">{label}</p>
      <h3 className="text-2xl sm:text-3xl font-bold text-white">{value}</h3>
    </div>
  );
}

function StreakCard({ icon, label, value, sub, color, border }) {
  return (
    <div className={`bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-5 sm:p-6 relative overflow-hidden group ${border} transition-all`}>
      <div className="absolute -right-16 -top-16 text-white/5 group-hover:text-white/10 transition-colors">
        <Icon icon={icon} width="120" height="120" />
      </div>
      <div className="relative z-10">
        <p className="text-xs sm:text-sm text-slate-400 mb-2 uppercase tracking-widest font-semibold">{label}</p>
        <h3 className={`text-3xl sm:text-4xl font-bold ${color} mb-1`}>{value}</h3>
        <p className="text-xs sm:text-sm text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
