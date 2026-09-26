import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useUser } from '../contexts/UserContext';
import { formatStudyTime } from '../data/examBank';
import useAnalyticsData from '../hooks/useAnalyticsData';

const DAILY_GOAL = 30;

function RemindersToggle() {
  const [enabled, setEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eduPractice_reminders') ?? 'true'); }
    catch { return true; }
  });

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem('eduPractice_reminders', JSON.stringify(next)); } catch {}
  };

  return (
    <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-6 flex items-center justify-between hover:border-white/10 transition-all">
      <div>
        <h4 className="text-sm font-semibold text-white mb-1">Study Reminders</h4>
        <p className="text-xs text-slate-500">Daily practice alerts</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 shrink-0 ${
          enabled ? 'bg-[#f99c00] border-[#f99c00]' : 'bg-slate-700 border-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function DashboardUI() {
  const { t, translate } = useLocalization();
  const { getFirstName } = useUser();
  const navigate = useNavigate();
  const [showPracticeModal, setShowPracticeModal] = useState(false);

  const { data, refresh: refreshData } = useAnalyticsData({ days: 30 });
  const { data: allTime } = useAnalyticsData({ days: null });
  const peakWeekly = Math.max(1, ...data.weeklyActivity.map(d => d.questions));
  const todayBucket = data.weeklyActivity[data.weeklyActivity.length - 1];
  const todayQuestions = todayBucket?.questions || 0;
  const dailyProgress = Math.min(100, Math.round((todayQuestions / DAILY_GOAL) * 100));
  const recentAttempts = allTime.attempts.slice(0, 3);
  const physics = allTime.subjectPerformance.find(s => s.subject === 'Physics');
  const maths   = allTime.subjectPerformance.find(s => s.subject === 'Mathematics');

  const handleResumePractice = () => {
    if (allTime.latest) setShowPracticeModal(true);
    else navigate('/mock-exams');
  };

  const handleStatClick = (statType) => {
    if (statType === 'questions' || statType === 'accuracy' || statType === 'studyTime') {
      navigate('/analytics');
    } else if (statType === 'exams') {
      navigate('/mock-exams');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0B1120]">
      {/* Header */}
      <div className="bg-[#0B1120] border-b border-white/5">
        <div className="px-4 sm:px-6 md:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">
                  {translate('dashboard.welcomeBack', { name: getFirstName() })}
                </h1>
                <p className="text-slate-400 text-sm mt-1">{t('dashboard.keepingMomentum')}</p>
              </div>
              <button
                onClick={handleResumePractice}
                className="w-full sm:w-auto px-6 py-3 bg-[#f99c00] hover:bg-[#f88c00] text-[#0B1120] rounded-lg font-semibold text-sm transition-all min-h-[44px] flex items-center justify-center gap-2 active:scale-95"
              >
                <Icon icon="solar:play-circle-linear" width="18" />
                <span>Resume Practice</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 md:px-8 py-8 pb-[88px] md:pb-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Stats Grid (real data from your attempts) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              onClick={() => handleStatClick('questions')}
              icon="solar:checklist-minimalistic-linear" tone="blue"
              label={t('dashboard.questionsSolved')}
              value={data.totalQuestions}
              badge={data.improvement !== 0
                ? { text: `${data.improvement > 0 ? '+' : ''}${data.improvement}%`, tone: data.improvement >= 0 ? 'good' : 'bad' }
                : { text: 'Last 30 days', tone: 'muted' }}
            />
            <StatCard
              onClick={() => handleStatClick('accuracy')}
              icon="solar:target-linear" tone="purple"
              label={t('dashboard.averageAccuracy')}
              value={`${data.accuracyOverall}%`}
              badge={{ text: `${data.totalAttempts} exam${data.totalAttempts === 1 ? '' : 's'}`, tone: 'muted' }}
            />
            <StatCard
              onClick={() => handleStatClick('studyTime')}
              icon="solar:clock-circle-linear" tone="rose"
              label={t('dashboard.studyTime')}
              value={formatStudyTime(data.studyMinutes)}
              badge={{ text: 'Last 30 days', tone: 'muted' }}
            />
            <StatCard
              onClick={() => handleStatClick('exams')}
              icon="solar:cup-star-linear" tone="amber"
              label={t('dashboard.examsPassed')}
              value={data.totalAttempts}
              badge={data.streak > 0 ? { text: `${data.streak}-day streak`, tone: 'good' } : null}
            />
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Learning Activity Chart */}
              <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-lg md:rounded-xl p-4 sm:p-5 md:p-6 hover:border-white/10 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                      {t('dashboard.learningActivity')}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1">
                      {t('dashboard.questionsAnsweredWeek')}
                    </p>
                  </div>
                  <select className="w-full sm:w-auto bg-white/5 border border-white/10 hover:border-white/20 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f99c00]/50 appearance-none transition-all min-h-[44px] sm:min-h-[40px]">
                    <option value="7" className="bg-[#111827]">{t('dashboard.lastSevenDays')}</option>
                    <option value="30" className="bg-[#111827]">{t('dashboard.lastThirtyDays')}</option>
                  </select>
                </div>

                <div className="h-56 flex items-end justify-between gap-1.5 mt-8 px-2">
                  {data.weeklyActivity.map((d, i) => {
                    const isToday = i === data.weeklyActivity.length - 1;
                    const heightPct = d.questions > 0
                      ? Math.max(8, Math.round((d.questions / peakWeekly) * 100))
                      : 4;
                    return (
                      <div key={i} className="w-full flex flex-col justify-end gap-2 group h-full">
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 relative ${
                            d.questions === 0
                              ? 'bg-white/5'
                              : isToday
                                ? 'bg-[#f99c00]'
                                : 'bg-[#f99c00]/30 hover:bg-[#f99c00]/60'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2a3441]/95 text-xs text-white px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-medium">
                            {d.questions} Qs · {d.minutes}m
                          </div>
                        </div>
                        <span className={`text-xs text-center font-semibold ${isToday ? 'text-[#f99c00]' : 'text-slate-500'}`}>
                          {d.label.charAt(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Sessions (real attempts) */}
              <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold tracking-tight text-white">{t('dashboard.recentSessions')}</h3>
                  <Link to="/analytics" className="text-sm text-[#f99c00] hover:text-[#f99c00]/80 font-medium transition-colors">
                    {t('dashboard.viewAll')}
                  </Link>
                </div>

                {recentAttempts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Icon icon="solar:notebook-bookmark-linear" width="36" className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm mb-3">No exam attempts yet.</p>
                    <Link
                      to="/mock-exams"
                      className="inline-block px-4 py-2 bg-[#f99c00] text-[#0B1120] rounded-lg text-sm font-semibold"
                    >
                      Take your first exam
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentAttempts.map(a => {
                      const isMath = a.subject === 'Mathematics';
                      const colorBg = isMath ? 'bg-rose-500/10' : 'bg-blue-500/10';
                      const colorText = isMath ? 'text-rose-400' : 'text-blue-400';
                      const scoreColor = a.percentage >= 80 ? 'text-emerald-400'
                                       : a.percentage >= 60 ? 'text-[#f99c00]' : 'text-rose-400';
                      const icon = isMath ? 'solar:calculator-linear' : 'solar:atom-linear';
                      return (
                        <Link
                          key={a.id}
                          to={`/exam/results/${a.id}`}
                          className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:border-white/10"
                        >
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className={`w-10 h-10 rounded-lg ${colorBg} flex items-center justify-center ${colorText} shrink-0`}>
                              <Icon icon={icon} width="20" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-medium text-white mb-1 truncate">{a.title}</h4>
                              <p className="text-xs text-slate-500 truncate">{a.subject} • {a.breakdown?.length || 0} Qs • {formatStudyTime(a.durationMin)}</p>
                            </div>
                          </div>
                          <div className="text-right pl-3 shrink-0">
                            <span className={`block text-sm font-semibold ${scoreColor} mb-1`}>{a.percentage}%</span>
                            <span className="block text-xs text-slate-500">{relativeTime(a.submittedAt)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Daily Goal */}
              <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:border-[#f99c00]/20 transition-all">
                <div className="absolute -right-12 -top-12 text-white/5 group-hover:text-white/10 transform rotate-12 pointer-events-none transition-colors">
                  <Icon icon="solar:target-linear" width="150" height="150" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('dashboard.dailyGoal')}</h3>
                  <p className="text-sm text-slate-400 mb-6">{t('dashboard.completeDailyQuestions')}</p>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-3xl font-semibold text-white leading-none">{todayQuestions}</span>
                    <span className="text-sm text-slate-500 leading-relaxed mb-1">/ {DAILY_GOAL}</span>
                  </div>
                  <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden mb-3 border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#f99c00] to-[#f88c00] rounded-full transition-all" style={{ width: `${dailyProgress}%` }} />
                  </div>
                  <p className="text-sm font-medium text-[#f99c00]">
                    {todayQuestions >= DAILY_GOAL
                      ? `Goal reached — great work!`
                      : `${DAILY_GOAL - todayQuestions} ${t('dashboard.questionsRemaining')}`}
                  </p>
                </div>
              </div>

              {/* Subject Mastery (real per-subject accuracy) */}
              <div className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all">
                <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.subjectMastery')}</h3>
                <div className="space-y-6">
                  <MasteryRow
                    name="Physics"
                    pct={physics?.mastery || 0}
                    sub={physics?.total ? `${physics.correct}/${physics.total} correct` : 'No data yet'}
                    pillBg="bg-blue-500/10"
                    barFrom="from-blue-500"
                    barTo="to-blue-600"
                  />
                  <MasteryRow
                    name="Mathematics"
                    pct={maths?.mastery || 0}
                    sub={maths?.total ? `${maths.correct}/${maths.total} correct` : 'No data yet'}
                    pillBg="bg-rose-500/10"
                    barFrom="from-rose-500"
                    barTo="to-rose-600"
                  />
                </div>
                <Link
                  to="/syllabus"
                  className="block w-full mt-6 py-3 rounded-lg border border-white/10 hover:border-[#f99c00]/30 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all active:scale-95 text-center"
                >
                  {t('dashboard.viewDetailedSyllabus')}
                </Link>
              </div>

              {/* Study Reminders Toggle */}
              <RemindersToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Resume Practice Modal — driven by your real recent attempts */}
      {showPracticeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
          <div className="bg-[#0B1120] border border-white/5 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md md:max-w-lg p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1">Resume your practice</h2>
            <p className="text-xs text-slate-400 mb-5">Pick a recent attempt to review, or start a new exam.</p>

            <div className="space-y-2 mb-6">
              {recentAttempts.map(a => (
                <button
                  key={a.id}
                  onClick={() => {
                    setShowPracticeModal(false);
                    navigate(`/exam/results/${a.id}`);
                  }}
                  className="w-full p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#f99c00]/30 transition-all text-left group active:scale-95"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-white group-hover:text-[#f99c00] transition-colors truncate pr-2">
                      {a.title}
                    </h4>
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-[#f99c00] shrink-0">
                      {a.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-[#f99c00] to-[#f88c00] rounded-full"
                      style={{ width: `${a.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{a.subject} • {relativeTime(a.submittedAt)}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPracticeModal(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg font-semibold transition-all text-sm min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPracticeModal(false);
                  navigate('/mock-exams');
                }}
                className="flex-1 px-4 py-2.5 bg-[#f99c00] hover:bg-[#f88c00] text-[#0B1120] rounded-lg font-semibold transition-all text-sm min-h-[40px]"
              >
                Start new exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function StatCard({ onClick, icon, tone, label, value, badge }) {
  const tones = {
    blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
    rose:   { bg: 'bg-rose-500/10',   text: 'text-rose-400' },
    amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-400' },
  };
  const c = tones[tone] || tones.blue;
  const badgeClass = badge?.tone === 'good'
    ? 'text-emerald-400 bg-emerald-500/10'
    : badge?.tone === 'bad'
      ? 'text-rose-300 bg-rose-500/10'
      : 'text-slate-400 bg-white/5';
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-br from-[#111827] to-[#0D0F1B] border border-white/5 rounded-xl p-6 hover:border-[#f99c00]/20 transition-all text-left group active:scale-95"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg ${c.bg} flex items-center justify-center ${c.text} group-hover:scale-110 transition-transform`}>
          <Icon icon={icon} width="24" />
        </div>
        {badge && (
          <span className={`text-xs font-bold ${badgeClass} px-2.5 py-1 rounded-full`}>{badge.text}</span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-white">{value}</h3>
    </button>
  );
}

function MasteryRow({ name, pct, sub, pillBg, barFrom, barTo }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-300">{name}</span>
          <span className="text-[11px] text-slate-500">{sub}</span>
        </div>
        <span className={`text-sm font-semibold text-white ${pillBg} px-3 py-1 rounded-full`}>{pct}%</span>
      </div>
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
        <div className={`h-full bg-gradient-to-r ${barFrom} ${barTo} rounded-full transition-all`} style={{ width: `${pct}%` }} />
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