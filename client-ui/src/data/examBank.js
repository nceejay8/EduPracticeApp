// Real UNEB-style question bank for dynamic exam generation.
// Subjects: Physics & Mathematics only.
// Each question has: id, subject, level, topic, difficulty, type, prompt,
// options (mcq), answer, explanation, marks, optional context (for scenarios).

import { enqueueSync } from '../lib/syncQueue';
import { resolveTopicRef } from './syllabus';

export const SUBJECTS = ['Physics', 'Mathematics'];
export const LEVELS = ['A-Level', 'UACE'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const LEVEL_EQUIVALENTS = {
  'A-Level': new Set(['A-Level', 'UACE']),
  UACE: new Set(['A-Level', 'UACE']),
};

function matchesRequestedLevel(questionLevel, requestedLevel) {
  if (!requestedLevel) return true;
  const allowed = LEVEL_EQUIVALENTS[requestedLevel] || new Set([requestedLevel]);
  return allowed.has(questionLevel);
}

// Questions tag themselves with legacy free-text topic strings ('Energy & Power',
// 'Gas Laws', 'Classical Mechanics') that do not match the official outline names
// used by the syllabus. Resolving each question to a canonical topic id once means
// a topic exam can be keyed on ids and still find the right questions. Cached
// because the alias index is static and buildExam runs on every exam start.
const questionTopicIdCache = new Map();

export function questionTopicId(question) {
  if (!question || !question.id) return null;
  if (questionTopicIdCache.has(question.id)) return questionTopicIdCache.get(question.id);
  const ref = resolveTopicRef(question.topic, question.subject);
  const id = ref?.topicId || null;
  questionTopicIdCache.set(question.id, id);
  return id;
}

// ---------- Multiple-choice / numeric question pool ----------
export const questionBank = [
  // -------- PHYSICS --------
  {
    id: 'phy-al-001', subject: 'Physics', level: 'A-Level', topic: 'Classical Mechanics',
    difficulty: 'Hard', type: 'numeric', marks: 3,
    prompt: 'An object moves in a circle of radius 2 m at constant 4 m/s. What is the centripetal acceleration in m/s²?',
    answer: 8, tolerance: 0.1,
    explanation: 'a = v² / r = 16 / 2 = 8 m/s².'
  },
  {
    id: 'phy-al-002', subject: 'Physics', level: 'A-Level', topic: 'Optics',
    difficulty: 'Hard', type: 'mcq', marks: 2,
    prompt: 'Light passes from air (n=1.0) into glass (n=1.5) at 30°. The refraction angle is approximately:',
    options: ['19.5°', '30°', '45°', '60°'],
    answer: '19.5°',
    explanation: 'Snell: sin(30°) = 1.5·sin(θ) → sin(θ) = 1/3 → θ ≈ 19.47°.'
  },
  {
    id: 'phy-al-003', subject: 'Physics', level: 'A-Level', topic: 'Modern Physics',
    difficulty: 'Hard', type: 'mcq', marks: 2,
    prompt: 'Who proposed that energy is quantized in discrete packets?',
    options: ['Newton', 'Einstein', 'Planck', 'Bohr'],
    answer: 'Planck',
    explanation: 'Max Planck proposed energy quantization (E = hf) in 1900, founding quantum theory.'
  },
  {
    id: 'phy-al-004', subject: 'Physics', level: 'A-Level', topic: 'Classical Mechanics',
    difficulty: 'Hard', type: 'numeric', marks: 3,
    prompt: 'A satellite orbits Earth at radius 7000 km with orbital speed 7500 m/s. What is its centripetal acceleration in m/s²? Round to 1 dp.',
    answer: 8.0, tolerance: 0.3,
    explanation: 'a = v² / r = (7500)² / 7,000,000 = 56,250,000 / 7,000,000 ≈ 8.04 m/s².'
  },
  {
    id: 'phy-uace-001', subject: 'Physics', level: 'UACE', topic: 'Modern Physics',
    difficulty: 'Hard', type: 'numeric', marks: 3,
    prompt: 'A photon has frequency 5 × 10¹⁴ Hz. What is its energy in 10⁻¹⁹ J? (h = 6.63 × 10⁻³⁴ J·s) Round to 1 dp.',
    answer: 3.3, tolerance: 0.2,
    explanation: 'E = hf = 6.63e−34 × 5e14 = 3.315e−19 J ≈ 3.3 × 10⁻¹⁹ J.'
  },

  // -------- MATHEMATICS --------
  {
    id: 'mat-al-001', subject: 'Mathematics', level: 'A-Level', topic: 'Pure Mathematics',
    difficulty: 'Hard', type: 'mcq', marks: 2,
    prompt: 'What is the modulus of the complex number z = 3 + 4i?',
    options: ['3', '4', '5', '7'],
    answer: '5',
    explanation: '|z| = √(3² + 4²) = √25 = 5.'
  },
  {
    id: 'mat-al-002', subject: 'Mathematics', level: 'A-Level', topic: 'Pure Mathematics',
    difficulty: 'Hard', type: 'numeric', marks: 3,
    prompt: 'Evaluate ∫₀⁴ (2x + 3) dx.',
    answer: 28, tolerance: 0.1,
    explanation: '∫(2x + 3)dx = x² + 3x. (16 + 12) − 0 = 28.'
  },
  {
    id: 'mat-al-003', subject: 'Mathematics', level: 'A-Level', topic: 'Statistics & Probability',
    difficulty: 'Hard', type: 'mcq', marks: 2,
    prompt: 'For a standard normal distribution, what % of values fall within one standard deviation of the mean?',
    options: ['~50%', '~68%', '~95%', '~99%'],
    answer: '~68%',
    explanation: 'The 68-95-99.7 rule: ~68% within 1σ, ~95% within 2σ, ~99.7% within 3σ.'
  },
  {
    id: 'mat-uace-001', subject: 'Mathematics', level: 'UACE', topic: 'Applied Mathematics',
    difficulty: 'Hard', type: 'numeric', marks: 3,
    prompt: 'A particle moves with position s(t) = t³ − 6t² + 9t. At what time t > 0 (seconds) is the velocity first zero?',
    answer: 1, tolerance: 0.05,
    explanation: 'v(t) = 3t² − 12t + 9 = 3(t − 1)(t − 3). First zero at t = 1 s.'
  },
];

// ---------- Scenario-based questions (Uganda context) ----------
// These mix a real-world context block with a calculation prompt.
// They are mixed into mock exams to test applied understanding.
export const scenarioBank = [
  {
    id: 'sce-phy-al-001', subject: 'Physics', level: 'A-Level', topic: 'Energy & Power',
    difficulty: 'Hard', type: 'numeric', marks: 4,
    context: 'Murchison Falls drops the River Nile through a vertical height of about 43 m. Suppose 200 kg of water falls every second. Take g = 10 m/s².',
    prompt: 'What is the maximum power (in kW) that could in principle be extracted from this water?',
    answer: 86, tolerance: 2,
    explanation: 'Power = (mass/sec) × g × h = 200 × 10 × 43 = 86,000 W = 86 kW.'
  },
  {
    id: 'sce-phy-al-002', subject: 'Physics', level: 'A-Level', topic: 'Gas Laws',
    difficulty: 'Hard', type: 'mcq', marks: 2,
    context: 'A climber ascends Mt. Rwenzori. At sea level the atmospheric pressure is 100 kPa. As she climbs, the air becomes thinner.',
    prompt: 'Which statement best describes what happens to atmospheric pressure as altitude increases?',
    options: [
      'Pressure increases linearly with altitude',
      'Pressure decreases (roughly exponentially) with altitude',
      'Pressure stays constant',
      'Pressure first increases then decreases'
    ],
    answer: 'Pressure decreases (roughly exponentially) with altitude',
    explanation: 'Atmospheric pressure decreases with altitude because there is less air above. The relationship is approximately exponential (barometric formula).'
  },

  {
    id: 'sce-mat-al-001', subject: 'Mathematics', level: 'A-Level', topic: 'Statistics & Probability',
    difficulty: 'Hard', type: 'mcq', marks: 2,
    context: 'Makerere University admitted 8,400 students out of 12,000 applicants this year. A new applicant is selected at random.',
    prompt: 'What is the probability that this applicant is admitted?',
    options: ['0.30', '0.50', '0.70', '0.84'],
    answer: '0.70',
    explanation: 'P = 8400 / 12000 = 0.70 (or 70%).'
  },
  {
    id: 'sce-mat-al-002', subject: 'Mathematics', level: 'A-Level', topic: 'Calculus Applications',
    difficulty: 'Hard', type: 'numeric', marks: 4,
    context: 'A water tank in Mbarara is being filled at a rate r(t) = 6t² + 2 litres per minute, where t is minutes since the pump started.',
    prompt: 'How many litres flow into the tank during the first 5 minutes?',
    answer: 260, tolerance: 1,
    explanation: 'Volume = ∫₀⁵ (6t² + 2) dt = [2t³ + 2t]₀⁵ = 2(125) + 10 = 250 + 10 = 260 L.'
  },
];

// ---------- Build / score ----------

// Build an exam.
// config: { subject, level, difficulty, count, topics?, scenarioCount? }
//   - count is the total number of questions
//   - scenarioCount (default 0) reserves N slots for scenario-based questions
export function buildExam({
  subject,
  level,
  difficulty,
  count = 10,
  topics = null,
  topicId = null,
  scenarioCount = 0,
} = {}) {
  // ---- pick scenarios first ----
  const scenarios = pickScenarios({ subject, level, scenarioCount, count, topicId });

  // ---- pick MCQ/numeric questions to fill the rest ----
  const targetMcq = Math.max(0, count - scenarios.length);
  const mcqs = pickFromBank({ subject, level, difficulty, topics, topicId, count: targetMcq });

  // Combine: scenarios first (good warm-up framing), then MCQ pool
  const merged = [...scenarios, ...mcqs].slice(0, count);

  return merged.map((q, idx) => ({ ...q, position: idx + 1 }));
}

function pickScenarios({ subject, level, scenarioCount, count, topicId }) {
  if (!scenarioCount || scenarioCount <= 0) return [];
  let pool = [...scenarioBank];
  if (topicId) {
    pool = pool.filter(q => questionTopicId(q) === topicId);
    const wanted = Math.min(scenarioCount, count, pool.length);
    return seededShuffle(pool, `sce-${topicId}-${Date.now()}`).slice(0, wanted);
  }
  if (subject) pool = pool.filter(q => q.subject === subject);
  if (level) pool = pool.filter(q => matchesRequestedLevel(q.level, level));
  // If too few, widen by removing level filter.
  if (pool.length < scenarioCount && subject) {
    pool = scenarioBank.filter(q => q.subject === subject && matchesRequestedLevel(q.level, level));
  }
  if (pool.length === 0) return [];
  const wanted = Math.min(scenarioCount, count, pool.length);
  return seededShuffle(pool, `sce-${subject}-${level}-${Date.now()}`).slice(0, wanted);
}

function pickFromBank({ subject, level, difficulty, topics, topicId, count }) {
  if (count <= 0) return [];

  // A topic exam must contain only that topic's questions. Widening the pool here
  // would hand a student a paper labelled "Forces and Equilibrium" that silently
  // contains wave questions, so the relaxation steps below are skipped.
  if (topicId) {
    const pool = questionBank.filter(
      q => questionTopicId(q) === topicId && (!subject || q.subject === subject) && matchesRequestedLevel(q.level, level)
    );
    if (pool.length === 0) return [];
    return seededShuffle(pool, `topic-${topicId}-${Date.now()}`).slice(0, count);
  }

  let pool = [...questionBank];
  if (subject) pool = pool.filter(q => q.subject === subject);
  if (level) pool = pool.filter(q => matchesRequestedLevel(q.level, level));
  if (topics && topics.length > 0) {
    // Resolve each requested topic name once; a name that does not resolve
    // (an ad-hoc custom topic) still matches literally.
    const ids = topics.map(name => resolveTopicRef(name, subject)?.topicId || null);
    pool = pool.filter(q => {
      const qid = questionTopicId(q);
      if (qid) return ids.includes(qid);
      return topics.includes(q.topic);
    });
  }

  if (difficulty) {
    const exact = pool.filter(q => q.difficulty === difficulty);
    if (exact.length >= Math.min(count, 3)) pool = exact;
  }

  // Relax progressively if we don't have enough
  if (pool.length < count && topics) {
    pool = questionBank.filter(q =>
      (!subject || q.subject === subject) && matchesRequestedLevel(q.level, level)
    );
  }
  if (pool.length < count && level) {
    pool = questionBank.filter(q =>
      (!subject || q.subject === subject) && matchesRequestedLevel(q.level, level)
    );
  }
  if (pool.length < count) pool = [...questionBank];

  const seed = `${subject || 'mix'}-${level || 'all'}-${difficulty || 'any'}-${Date.now()}`;
  return seededShuffle(pool, seed).slice(0, count);
}

// Score a completed exam.
export function scoreExam(questions, answers) {
  let earned = 0;
  let totalMarks = 0;
  const breakdown = [];

  for (const q of questions) {
    totalMarks += q.marks || 1;
    const user = answers[q.id];
    let correct = false;

    if (user === undefined || user === null || user === '') {
      correct = false;
    } else if (q.type === 'numeric') {
      const num = typeof user === 'number' ? user : parseFloat(user);
      const tol = q.tolerance ?? 0.01;
      correct = !Number.isNaN(num) && Math.abs(num - q.answer) <= tol;
    } else {
      correct = String(user).trim() === String(q.answer).trim();
    }

    if (correct) earned += q.marks || 1;

    breakdown.push({
      id: q.id,
      prompt: q.prompt,
      context: q.context || null,
      topic: q.topic,
      subject: q.subject,
      difficulty: q.difficulty,
      type: q.type,
      userAnswer: user ?? null,
      correctAnswer: q.answer,
      explanation: q.explanation,
      correct,
      marks: q.marks || 1,
      isScenario: !!q.context,
    });
  }

  const percentage = totalMarks > 0 ? Math.round((earned / totalMarks) * 100) : 0;

  const byTopic = {};
  breakdown.forEach(b => {
    if (!byTopic[b.topic]) byTopic[b.topic] = { correct: 0, total: 0 };
    byTopic[b.topic].total += 1;
    if (b.correct) byTopic[b.topic].correct += 1;
  });
  const topicAccuracy = Object.entries(byTopic).map(([topic, v]) => ({
    topic,
    accuracy: Math.round((v.correct / v.total) * 100),
    correct: v.correct,
    total: v.total,
  }));

  return { earned, totalMarks, percentage, breakdown, topicAccuracy };
}

// ---- seeded shuffle helpers ----
function seededShuffle(arr, seedStr) {
  const seed = hashString(seedStr);
  let a = seed >>> 0;
  const rand = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- Persistence ----------
const ATTEMPTS_KEY = 'eduPractice_examAttempts';

// Local-first. The local write is the one that must never fail: it is what the
// student sees immediately, offline or not. Syncing is queued, not attempted
// inline, because an inline push that fails is an attempt that silently never
// reaches the server — see lib/syncQueue.js.
export function saveAttempt(attempt, userId) {
  const existing = listAttempts();
  existing.unshift(attempt);
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(existing.slice(0, 50)));

  if (userId) {
    enqueueSync({ id: attempt.id, table: 'exam_attempts', row: examAttemptToRow(attempt, userId) });
  }
}

export function examAttemptToRow(attempt, userId) {
  return {
    user_id: userId,
    exam_id: attempt.id, // keep the local attempt id linkable from analytics
    title: attempt.title,
    subtitle: attempt.subtitle,
    subject: attempt.subject,
    level: attempt.level,
    percentage: attempt.percentage ?? 0,
    breakdown: Array.isArray(attempt.breakdown) ? attempt.breakdown : [],
    duration_min: attempt.durationMin ?? 0,
    submitted_at: attempt.submittedAt || new Date().toISOString(),
  };
}
export function listAttempts() {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]'); }
  catch { return []; }
}
export function getAttempt(id) {
  return listAttempts().find(a => a.id === id) || null;
}

// ---------- Analytics derived from real attempts ----------
// Pure function — accepts an explicit attempts array (from localStorage OR Supabase).
// Accepts an optional period in days (e.g., 7, 30, 90). null = all-time.
export function computeAnalytics(allAttempts, { days = null } = {}) {
  const all = allAttempts;
  const now = Date.now();
  const cutoff = days ? now - days * 86400000 : 0;
  const attempts = days ? all.filter(a => new Date(a.submittedAt).getTime() >= cutoff) : all;

  const totalQuestions = attempts.reduce((s, a) => s + (a.breakdown?.length || 0), 0);
  const totalCorrect   = attempts.reduce((s, a) => s + (a.breakdown?.filter(b => b.correct).length || 0), 0);
  const totalMinutes   = attempts.reduce((s, a) => s + (a.durationMin || 0), 0);
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
    : 0;

  // Per-subject performance (only Physics & Mathematics)
  const subjectStats = {};
  SUBJECTS.forEach(s => { subjectStats[s] = { correct: 0, total: 0, attempts: 0, minutes: 0 }; });
  attempts.forEach(a => {
    (a.breakdown || []).forEach(b => {
      const s = b.subject || a.subject;
      if (subjectStats[s]) {
        subjectStats[s].total += 1;
        if (b.correct) subjectStats[s].correct += 1;
      }
    });
    if (subjectStats[a.subject]) {
      subjectStats[a.subject].attempts += 1;
      subjectStats[a.subject].minutes += a.durationMin || 0;
    }
  });
  const subjectPerformance = SUBJECTS.map(s => {
    const v = subjectStats[s];
    return {
      subject: s,
      mastery: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      attempts: v.attempts,
      minutes: v.minutes,
      total: v.total,
      correct: v.correct,
    };
  });

  // Daily activity for the last 7 days (Mon..Sun in local time)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    week.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
      questions: 0, correct: 0, minutes: 0,
    });
  }
  const weekIndex = Object.fromEntries(week.map((w, i) => [w.key, i]));
  all.forEach(a => {
    const key = new Date(a.submittedAt).toISOString().slice(0, 10);
    if (key in weekIndex) {
      const w = week[weekIndex[key]];
      w.questions += a.breakdown?.length || 0;
      w.correct   += a.breakdown?.filter(b => b.correct).length || 0;
      w.minutes   += a.durationMin || 0;
    }
  });

  // Streak: distinct days with at least one attempt, ending today/yesterday
  const dayKeys = new Set(all.map(a => new Date(a.submittedAt).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  // Allow today OR yesterday to start the streak
  if (!dayKeys.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak (over all time)
  const sortedDays = [...dayKeys].sort();
  let longest = 0, current = 0, lastDate = null;
  sortedDays.forEach(key => {
    const d = new Date(key);
    if (lastDate && (d - lastDate) === 86400000) current += 1;
    else current = 1;
    if (current > longest) longest = current;
    lastDate = d;
  });

  // Improvement: compare avg of first 3 vs last 3 attempts (within period)
  const sortedAttempts = [...attempts].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  let improvement = 0;
  if (sortedAttempts.length >= 3) {
    const first3 = sortedAttempts.slice(0, 3).reduce((s, a) => s + a.percentage, 0) / 3;
    const last3  = sortedAttempts.slice(-3).reduce((s, a) => s + a.percentage, 0) / 3;
    improvement = Math.round(last3 - first3);
  }

  // Latest attempt (for "resume" buttons)
  const latest = all.length ? all[0] : null;

  return {
    period: days,
    attempts,
    totalAttempts: attempts.length,
    totalQuestions,
    totalCorrect,
    avgScore,
    accuracyOverall: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    studyMinutes: totalMinutes,
    subjectPerformance,
    weeklyActivity: week,
    streak,
    longestStreak: longest,
    improvement,
    latest,
  };
}

// Convenience wrapper that reads from localStorage — keeps backward compatibility.
export function deriveAnalytics({ days = null } = {}) {
  return computeAnalytics(listAttempts(), { days });
}

export function formatStudyTime(mins) {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
