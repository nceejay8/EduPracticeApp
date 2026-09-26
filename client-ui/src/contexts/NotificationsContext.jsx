import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { deriveAnalytics, listAttempts } from '../data/examBank';

const NotificationsContext = createContext(null);

const READ_KEY   = 'edupractice_notif_read';
const PREFS_KEY  = 'edupractice_user_prefs';
// Cleared notifications cannot just be dropped from state: the list is derived
// from analytics on every refresh(), so anything removed without a record here
// would reappear the moment the student answered a question.
const DISMISSED_KEY = 'edupractice_notif_dismissed';

function loadReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveReadIds(ids) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])); }
  catch {}
}

function loadDismissedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveDismissedIds(ids) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); }
  catch {}
}

const MAESTRO_TIPS = [
  { id: 'tip_1', body: 'For projectile motion, always split velocity into horizontal and vertical components first.' },
  { id: 'tip_2', body: 'In integration, remember the "+ C" for indefinite integrals — UACE examiners always check this.' },
  { id: 'tip_3', body: 'When drawing free-body diagrams, label every force with its direction and magnitude.' },
  { id: 'tip_4', body: 'For circuit problems, apply Kirchhoff\'s laws systematically — start with the loop rule.' },
  { id: 'tip_5', body: 'Differentiation and integration are inverse operations — use this to check your answers.' },
  { id: 'tip_6', body: 'Always state your units at every step. UACE marking schemes deduct marks for missing units.' },
  { id: 'tip_7', body: 'For wave problems, memorise: v = fλ. Then link wavelength, frequency and wave speed clearly.' },
  { id: 'tip_8', body: 'Sketch a graph first whenever a calculus question mentions area under a curve.' },
];

function generateNotifications(analytics, userPrefs) {
  const now = Date.now();
  const todayKey = new Date().toISOString().slice(0, 10);
  const notifs = [];

  const { streak, weeklyActivity, subjectPerformance, totalAttempts, avgScore, attempts } = analytics;

  // ── 1. Streak at risk ──────────────────────────────────────────────────────
  const todayActivity = weeklyActivity.find(w => w.key === todayKey);
  const practicedToday = (todayActivity?.questions || 0) > 0;
  const hour = new Date().getHours();

  if (streak > 0 && !practicedToday && hour >= 14) {
    notifs.push({
      id: `streak_risk_${todayKey}`,
      type: 'warning',
      icon: 'solar:fire-bold',
      iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/15',
      title: `Keep your ${streak}-day streak alive!`,
      body: 'You haven\'t practiced yet today. Do at least one question before midnight.',
      cta: { label: 'Practice now', path: '/practice' },
      timestamp: now - 3600000,
      today: true,
    });
  }

  // ── 2. Daily goal progress ──────────────────────────────────────────────────
  const dailyGoal = userPrefs?.dailyGoal || 50;
  const todayQuestions = todayActivity?.questions || 0;
  if (todayQuestions > 0 && todayQuestions < dailyGoal) {
    const remaining = dailyGoal - todayQuestions;
    notifs.push({
      id: `goal_${todayKey}`,
      type: 'info',
      icon: 'solar:target-bold',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15',
      title: `${remaining} questions to hit today's goal`,
      body: `You've answered ${todayQuestions} of ${dailyGoal} today. Keep going — you're making progress!`,
      cta: { label: 'Continue', path: '/practice' },
      timestamp: now - 1800000,
      today: true,
    });
  } else if (todayQuestions >= dailyGoal && dailyGoal > 0) {
    notifs.push({
      id: `goal_done_${todayKey}`,
      type: 'success',
      icon: 'solar:check-circle-bold',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15',
      title: 'Daily goal complete!',
      body: `You hit your target of ${dailyGoal} questions today. Excellent discipline!`,
      timestamp: now - 900000,
      today: true,
    });
  }

  // ── 3. Recent score feedback ────────────────────────────────────────────────
  const latestAttempt = attempts?.[0];
  if (latestAttempt) {
    const attemptDate = new Date(latestAttempt.submittedAt);
    const ageMs = now - attemptDate.getTime();
    const ageHours = ageMs / 3600000;
    if (ageHours < 24) {
      const score = latestAttempt.percentage;
      let title, body;
      if (score >= 80) {
        title = `Great score — ${score}% on ${latestAttempt.topic || 'latest practice'}`;
        body = 'You\'re on track for a grade 1. Try a harder question to keep challenging yourself.';
      } else if (score >= 60) {
        title = `${score}% — room to improve`;
        body = `Review the mark scheme for "${latestAttempt.topic || 'this topic'}" and ask Maestro about the parts you lost marks on.`;
      } else {
        title = `${score}% — let\'s revisit this topic`;
        body = `"${latestAttempt.topic || 'This topic'}" needs more work. Ask Maestro to explain the key concepts.`;
      }
      notifs.push({
        id: `score_${latestAttempt.id || attemptDate.getTime()}`,
        type: score >= 80 ? 'success' : score >= 60 ? 'info' : 'warning',
        icon: score >= 80 ? 'solar:star-bold' : 'solar:chart-2-bold',
        iconColor: score >= 80 ? 'text-amber-400' : score >= 60 ? 'text-blue-400' : 'text-orange-400',
        iconBg: score >= 80 ? 'bg-amber-500/15' : score >= 60 ? 'bg-blue-500/15' : 'bg-orange-500/15',
        title,
        body,
        cta: { label: 'Ask Maestro', path: '/practice' },
        timestamp: attemptDate.getTime(),
        today: ageHours < 6,
      });
    }
  }

  // ── 4. Subject imbalance ────────────────────────────────────────────────────
  const [phy, mth] = subjectPerformance || [];
  if (phy && mth && (phy.attempts + mth.attempts) >= 3) {
    const dominantSubject = phy.attempts > mth.attempts * 2 ? 'Mathematics' : mth.attempts > phy.attempts * 2 ? 'Physics' : null;
    if (dominantSubject) {
      notifs.push({
        id: `imbalance_${dominantSubject}`,
        type: 'info',
        icon: 'solar:book-2-bold',
        iconColor: 'text-violet-400',
        iconBg: 'bg-violet-500/15',
        title: `Don't neglect ${dominantSubject}`,
        body: `Your recent sessions have focused heavily on one subject. UACE requires strength in both Physics and Mathematics.`,
        cta: { label: `Practice ${dominantSubject}`, path: `/practice?subject=${dominantSubject.toLowerCase()}` },
        timestamp: now - 7200000,
        today: false,
      });
    }
  }

  // ── 5. Milestone notifications ──────────────────────────────────────────────
  const milestones = [5, 10, 25, 50, 100];
  const crossed = milestones.filter(m => totalAttempts >= m);
  if (crossed.length > 0) {
    const latest = crossed[crossed.length - 1];
    notifs.push({
      id: `milestone_${latest}`,
      type: 'success',
      icon: 'solar:cup-star-bold',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15',
      title: `${latest} practice sessions completed!`,
      body: `Milestone reached. Your consistency is your biggest asset — keep it up.`,
      timestamp: now - 86400000 * 2,
      today: false,
    });
  }

  // ── 6. Rotating Maestro tip ─────────────────────────────────────────────────
  const tipIndex = new Date().getDay() % MAESTRO_TIPS.length;
  const tip = MAESTRO_TIPS[tipIndex];
  notifs.push({
    // Date-scoped so that clearing it dismisses today's tip rather than that
    // tip forever — the same tip comes round again in eight days.
    id: `${tip.id}_${todayKey}`,
    type: 'tip',
    icon: 'solar:diploma-bold',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    title: 'Maestro\'s tip of the day',
    body: tip.body,
    timestamp: now - 86400000,
    today: false,
  });

  // ── 7. New user welcome ─────────────────────────────────────────────────────
  if (totalAttempts === 0) {
    notifs.unshift({
      id: 'welcome',
      type: 'info',
      icon: 'solar:hand-shake-bold',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15',
      title: 'Welcome to EduPractice!',
      body: 'Start your first practice session to get personalised feedback from Maestro AI.',
      cta: { label: 'Start practicing', path: '/practice' },
      timestamp: now - 600000,
      today: true,
    });
  }

  // Sort: today's items first (by timestamp desc), then older ones
  notifs.sort((a, b) => {
    if (a.today && !b.today) return -1;
    if (!a.today && b.today) return 1;
    return b.timestamp - a.timestamp;
  });

  return notifs;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(loadReadIds);
  const [dismissedIds, setDismissedIds] = useState(loadDismissedIds);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      const analytics = deriveAnalytics({ days: 30 });
      const prefs = (() => {
        try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
        catch { return {}; }
      })();
      setNotifications(generateNotifications(analytics, prefs));
    } catch (err) {
      setError('Failed to refresh notifications');
      console.error('Notifications refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Dismissals are filtered at render rather than inside generateNotifications,
  // so a refresh after clearing can never resurrect what the student removed.
  const visible = notifications.filter(n => !dismissedIds.has(n.id));

  // Counted from the visible list: a dismissed notification must not keep
  // inflating the badge after it has been cleared.
  const unreadCount = visible.filter(n => !readIds.has(n.id)).length;

  const markRead = useCallback((id) => {
    setReadIds(prev => {
      const next = new Set(prev); next.add(id); saveReadIds(next); return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      saveReadIds(next);
      return next;
    });
  }, [notifications]);

  const clearAll = useCallback(() => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      saveDismissedIds(next);
      return next;
    });
    // Also clear the read state, otherwise the ids stay in the read set forever
    // and a notification that legitimately returns (a new day's tip) would
    // arrive already read.
    setReadIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.delete(n.id));
      saveReadIds(next);
      return next;
    });
  }, [notifications]);

  const enriched = visible.map(n => ({
    ...n,
    isRead: readIds.has(n.id),
    timeAgo: timeAgo(n.timestamp),
  }));

  return (
    <NotificationsContext.Provider value={{ notifications: enriched, unreadCount, markRead, markAllRead, clearAll, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
