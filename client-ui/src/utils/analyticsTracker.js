/**
 * Analytics Tracker - Tracks user interactions and generates real metrics
 * Stores data in localStorage for persistence across sessions
 *
 * Practice attempts are additionally queued for server sync (see lib/syncQueue.js)
 * so progress follows a student to another device. The local write below remains
 * the source of truth for the current device and is never blocked on the network.
 */

import { practiceAttemptId, practiceAttemptToRow } from '../lib/attemptMerge';
import { enqueueSync } from '../lib/syncQueue';

const STORAGE_KEY = 'edu_practice_analytics';

// Initialize or retrieve analytics data
const getAnalyticsData = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    sessionStartTime: new Date().toISOString(),
    topicsViewed: [],
    practiceAttempts: [],
    examsStarted: [],
    examsCompleted: [],
    chatInteractions: 0,
    totalTimeSpent: 0, // in minutes
    lastUpdated: new Date().toISOString(),
  };
};

// Save analytics data
const saveAnalyticsData = (data) => {
  data.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Track topic view
export const trackTopicView = (topicName, topicId) => {
  const data = getAnalyticsData();
  const timestamp = new Date().toISOString();
  
  data.topicsViewed.push({
    topicName,
    topicId,
    timestamp,
    duration: 0, // Will be updated on topic switch
  });
  
  saveAnalyticsData(data);
};

// Track practice attempt.
// `meta` is optional and carries the syllabus coordinates of the attempt
// ({ subject, topicId, chapterId, topicName }) so per-topic progress can be
// derived later. Older call sites that only pass the display name still work —
// the reader just resolves by name.
//
// The id is generated here, at record time, and is what makes the attempt
// de-duplicate against its server row. Attempts recorded before ids existed get
// a derived one (see practiceAttemptId) so they cannot be double-counted after
// their first sync.
export const trackPracticeAttempt = (topicName, score, duration, meta = {}, userId = null) => {
  const data = getAnalyticsData();

  const attempt = {
    topicName,
    score, // Score as percentage
    duration, // Duration in minutes
    timestamp: new Date().toISOString(),
    ...(meta.subject ? { subject: meta.subject } : {}),
    ...(meta.topicId ? { topicId: meta.topicId } : {}),
    ...(meta.chapterId ? { chapterId: meta.chapterId } : {}),
  };
  attempt.id = practiceAttemptId(attempt);

  data.practiceAttempts.push(attempt);
  saveAnalyticsData(data);

  // Queued, not pushed: an inline push that fails while offline is an attempt
  // that never reaches the server and is never retried.
  if (userId) {
    enqueueSync({ id: attempt.id, table: 'practice_attempts', row: practiceAttemptToRow(attempt, userId) });
  }
};

// Practice attempts, newest first — the practice half of the input to
// computeSyllabusProgress().
//
// Local records are given a stable id (or a derived one for records written
// before ids existed) so that merging with the server copy de-duplicates
// instead of double-counting.
export const getPracticeAttempts = () => {
  const data = getAnalyticsData();
  if (!Array.isArray(data.practiceAttempts)) return [];
  return data.practiceAttempts
    .map(a => (a.id ? a : { ...a, id: practiceAttemptId(a) }))
    .reverse();
};

// Track exam start
export const trackExamStart = (examName, examLevel) => {
  const data = getAnalyticsData();
  
  data.examsStarted.push({
    examName,
    examLevel,
    startTime: new Date().toISOString(),
  });
  
  saveAnalyticsData(data);
};

// Track exam completion
export const trackExamCompletion = (examName, score, duration) => {
  const data = getAnalyticsData();
  
  data.examsCompleted.push({
    examName,
    score, // Score as percentage
    duration, // Duration in minutes
    timestamp: new Date().toISOString(),
  });
  
  saveAnalyticsData(data);
};

// Track chat interaction
export const trackChatInteraction = (messageType) => {
  const data = getAnalyticsData();
  data.chatInteractions += 1;
  saveAnalyticsData(data);
};

// Calculate metrics
export const getMetrics = () => {
  const data = getAnalyticsData();
  
  // Calculate improvement (compare first 3 vs last 3 practice attempts)
  const practiceScores = data.practiceAttempts.map(p => p.score);
  let improvement = 0;
  if (practiceScores.length >= 3) {
    const firstThree = practiceScores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const lastThree = practiceScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
    improvement = Math.round(lastThree - firstThree);
  }
  
  // Calculate average accuracy from practice and exams
  const allScores = [
    ...data.practiceAttempts.map(p => p.score),
    ...data.examsCompleted.map(e => e.score),
  ];
  const avgAccuracy = allScores.length > 0 
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;
  
  // Total exams taken
  const examsTaken = data.examsCompleted.length;
  
  // Topics mastered (topics with average score > 80%)
  const topicScores = {};
  data.practiceAttempts.forEach(attempt => {
    if (!topicScores[attempt.topicName]) {
      topicScores[attempt.topicName] = [];
    }
    topicScores[attempt.topicName].push(attempt.score);
  });
  
  const topicsMastered = Object.values(topicScores).filter(scores => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg > 80;
  }).length;
  
  return {
    improvement, // e.g., "+15" means 15% improvement
    examsTaken,
    avgAccuracy,
    topicsMastered,
    totalAttempts: data.practiceAttempts.length,
    chatInteractions: data.chatInteractions,
    practiceScores,
    examsScores: data.examsCompleted.map(e => e.score),
  };
};

// Reset analytics (for testing)
export const resetAnalytics = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// Get raw analytics data (for debugging)
export const getRawAnalyticsData = () => {
  return getAnalyticsData();
};

export default {
  trackTopicView,
  trackPracticeAttempt,
  getPracticeAttempts,
  trackExamStart,
  trackExamCompletion,
  trackChatInteraction,
  getMetrics,
  resetAnalytics,
  getRawAnalyticsData,
};
