// Topic-wise progress over the canonical syllabus outline.
//
// Answers "how far through each topic has this student actually got?" by
// folding together the two places the app records work:
//
//   1. Exam attempts — `attempt.breakdown[]` items, each with a `topic` string,
//      `marks` and a `correct` flag. Sourced from Supabase *and* localStorage
//      via useAnalyticsData, so this half works cross-device.
//   2. AI workboard practice — `analyticsTracker` practice attempts, each with
//      a `topicName` and a 0-100 score. localStorage only (see the note in
//      Practice.jsx), so practice scores are device-local for now.
//
// Every recorded topic string is a legacy free-text tag, so nothing is credited
// until `resolveTopicRef()` maps it onto the outline. Unattributable content is
// reported rather than silently dropped, so a mis-tagged question is visible
// instead of invisible.
//
// Everything here is a pure function of its arguments — no Supabase, no React —
// which keeps it cheap to call on every render and trivial to reason about.

import {
  SUBJECT_IDS,
  SYLLABUS,
  countSubtopics,
  countTopics,
  getSubject,
  listChapters,
  listTopics,
  normalizeSubject,
  resolveContentRef,
} from './syllabus';
import { questionBank, scenarioBank } from './examBank';
import { PRACTICE_SCENARIOS, getCustomScenarios } from './practiceScenarios';
import { getPublishedScenarios } from './publishedScenarios';

// Accuracy bands. The 80/50 split matches the thresholds already used for
// per-topic bars in ExamResults.jsx so the two views read identically.
export const MASTERY_THRESHOLD = 80;
export const DEVELOPING_THRESHOLD = 50;

export const STATUS_META = {
  'not-started': { label: 'Not started', tone: 'slate', icon: 'solar:record-circle-linear' },
  learning:     { label: 'Needs work',  tone: 'rose',  icon: 'solar:close-circle-bold' },
  developing:   { label: 'Developing',  tone: 'amber', icon: 'solar:loader-bold' },
  mastered:     { label: 'Mastered',    tone: 'emerald', icon: 'solar:check-circle-bold' },
};

function emptyStats() {
  return { attempts: 0, total: 0, correct: 0, accuracy: 0, lastPracticedAt: null };
}

function credit(stats, marks, earned, timestamp) {
  const weight = marks > 0 ? marks : 1;
  stats.attempts += 1;
  stats.total += weight;
  stats.correct += Math.min(Math.max(earned, 0), weight);
  if (timestamp) {
    const t = new Date(timestamp).getTime();
    if (!Number.isNaN(t) && (!stats.lastPracticedAt || t > new Date(stats.lastPracticedAt).getTime())) {
      stats.lastPracticedAt = timestamp;
    }
  }
}

function finalise(stats) {
  stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  stats.status = statusFor(stats);
  return stats;
}

export function statusFor(stats) {
  if (!stats || !stats.total) return 'not-started';
  if (stats.accuracy >= MASTERY_THRESHOLD) return 'mastered';
  if (stats.accuracy >= DEVELOPING_THRESHOLD) return 'developing';
  return 'learning';
}

function mergeStats(...parts) {
  const out = emptyStats();
  for (const part of parts) {
    if (!part) continue;
    out.attempts += part.attempts;
    out.total += part.total;
    out.correct += part.correct;
    if (part.lastPracticedAt && (!out.lastPracticedAt || new Date(part.lastPracticedAt) > new Date(out.lastPracticedAt))) {
      out.lastPracticedAt = part.lastPracticedAt;
    }
  }
  return finalise(out);
}

// ─── Content resolution ─────────────────────────────────────────────────────

// Re-exported from syllabus.js so the content attribution rule has one home.
// It is defined there because the practice scenario picker needs it too, and
// this module already imports that picker.
export { resolveContentRef };

// ─── Content coverage ───────────────────────────────────────────────────────

// How much material actually exists behind each topic. This is what lets the
// outline distinguish "you haven't studied this" from "there is nothing here to
// study yet" — a distinction that matters a lot when a student sees a mostly
// empty syllabus.
//
// Three pools, because three different code paths serve them and each has its
// own limits. Keeping them apart is what stops the page from promising more
// than a button can deliver:
//   exam      — questionBank, the MCQ/numeric pool buildExam draws from
//   scenario  — scenarioBank, the Uganda-context questions that are only
//               reachable when an exam explicitly reserves scenario slots
//   practice  — PRACTICE_SCENARIOS + admin scenarios, what the AI workboard
//               serves for the topic
const COVERAGE_CACHE = new Map();

function buildCoverage(subjectId) {
  const ifCached = COVERAGE_CACHE.get(subjectId);
  if (ifCached) return ifCached;

  const blank = () => ({ exam: 0, scenario: 0, practice: 0, examTotal: 0, total: 0 });
  const map = {
    topics: {},
    subtopics: {},
    chapters: {},
    // Content tagged with a paper-level name ('Applied Mathematics') rather than
    // a chapter, topic or subtopic. Tracked separately from `unattributed`,
    // which means "we could not place this anywhere".
    subjectLevel: blank(),
    unattributed: { exam: 0, scenario: 0, practice: 0, items: [] },
  };

  const bumpTopic = (topicId, kind) => {
    if (!map.topics[topicId]) map.topics[topicId] = blank();
    map.topics[topicId][kind] += 1;
  };

  const bump = (ref, kind) => {
    if (ref.level === 'subtopic') {
      if (!map.subtopics[ref.subtopicId]) map.subtopics[ref.subtopicId] = blank();
      map.subtopics[ref.subtopicId][kind] += 1;
      bumpTopic(ref.topicId, kind);
    } else if (ref.level === 'topic') {
      bumpTopic(ref.topicId, kind);
    } else if (ref.level === 'chapter') {
      if (!map.chapters[ref.chapterId]) map.chapters[ref.chapterId] = blank();
      map.chapters[ref.chapterId][kind] += 1;
      // A chapter-wide scenario is servable for any topic in that chapter, so it
      // counts towards each of them — practice only. Exam pools are deliberately
      // NOT credited to every topic in the chapter: that would offer a "topic
      // exam" per topic built from the same handful of questions, and report a
      // question count the topic exam cannot deliver.
      if (kind === 'practice') {
        listChapters(ref.subjectId)
          .find(c => c.id === ref.chapterId)
          ?.topics.forEach(t => bumpTopic(t.id, 'practice'));
      }
    } else if (ref.level === 'subject') {
      map.subjectLevel[kind] += 1;
    } else {
      map.unattributed[kind] += 1;
      map.unattributed.items.push({ kind, name: ref.raw });
    }
  };

  const tally = (bucket) => {
    bucket.examTotal = bucket.exam + bucket.scenario;
    bucket.total = bucket.examTotal + bucket.practice;
  };

  [...questionBank].forEach(q => {
    const subject = normalizeSubject(q.subject);
    if (subject !== subjectId) return; // coverage is per-subject, not global
    const ref = resolveContentRef(subject, q.topic, q.topics);
    bump(ref ? { ...ref, raw: q.topic } : { level: 'unknown', raw: q.topic }, 'exam');
  });

  [...scenarioBank].forEach(q => {
    const subject = normalizeSubject(q.subject);
    if (subject !== subjectId) return;
    const ref = resolveContentRef(subject, q.topic, q.topics);
    bump(ref ? { ...ref, raw: q.topic } : { level: 'unknown', raw: q.topic }, 'scenario');
  });

  [...PRACTICE_SCENARIOS, ...getCustomScenarios(), ...getPublishedScenarios()].forEach(s => {
    const subject = normalizeSubject(s.subject);
    if (subject !== subjectId) return;
    const ref = resolveContentRef(subject, s.topic, s.topics);
    bump(ref ? { ...ref, raw: s.topic } : { level: 'unknown', raw: s.topic }, 'practice');
  });

  Object.values(map.topics).forEach(tally);
  Object.values(map.subtopics).forEach(tally);
  Object.values(map.chapters).forEach(tally);
  tally(map.subjectLevel);

  COVERAGE_CACHE.set(subjectId, map);
  return map;
}

export function getCoverage(subjectId) {
  const subject = normalizeSubject(subjectId);
  if (!subject) return null;
  return buildCoverage(subject);
}

export function getTopicCoverage(subjectId, topicId) {
  const coverage = getCoverage(subjectId);
  if (!coverage) return emptyCoverage();
  return coverage.topics[topicId] || emptyCoverage();
}

export function emptyCoverage() {
  return { exam: 0, scenario: 0, practice: 0, examTotal: 0, total: 0 };
}

export function getSubjectCoverage(subjectId) {
  const coverage = getCoverage(subjectId);
  if (!coverage) {
    return {
      topicsWithContent: 0, topicsTotal: 0, items: 0,
      unattributed: { exam: 0, scenario: 0, practice: 0, items: [] },
      subjectLevel: emptyCoverage(),
      chapters: {},
    };
  }
  const topicsWithContent = Object.values(coverage.topics).filter(t => t.total > 0).length;
  const items = Object.values(coverage.topics).reduce((s, t) => s + t.total, 0)
    + coverage.subjectLevel.total
    + coverage.unattributed.exam + coverage.unattributed.scenario + coverage.unattributed.practice;
  return {
    topicsWithContent,
    topicsTotal: countTopics(subjectId),
    items,
    // Chapter-level practice is also credited to its topics, so `items` is a
    // count of placed pieces, not a sum of per-topic totals.
    chapters: coverage.chapters,
    subjectLevel: coverage.subjectLevel,
    unattributed: coverage.unattributed,
  };
}

// Clears the coverage memo. Only needed if scenario data becomes mutable at
// runtime (e.g. a scenario is edited while the page is open).
export function invalidateCoverage() {
  COVERAGE_CACHE.clear();
}

// ─── Progress ───────────────────────────────────────────────────────────────

// Builds the full annotated outline: every chapter, topic and subtopic in the
// syllabus, each carrying its own stats, rolled up to its parents.
//
// `attempts`        — exam attempts (useAnalyticsData `data.attempts`, or listAttempts())
// `practiceAttempts` — raw analyticsTracker practice attempts
export function computeSyllabusProgress({ attempts = [], practiceAttempts = [] } = {}) {
  const subjects = {};
  const unattributed = [];

  SUBJECT_IDS.forEach(subjectId => {
    const subject = getSubject(subjectId);
    const coverage = getCoverage(subjectId);

    // Fresh stat buckets keyed by id.
    const subtopicStats = {};
    const topicStats = {};
    const chapterMixedStats = {};
    const subjectMixedStats = emptyStats();

    const bucket = (store, key) => {
      if (!store[key]) store[key] = emptyStats();
      return store[key];
    };

    // ── Fold in exam attempts ────────────────────────────────────────────
    attempts.forEach(attempt => {
      (attempt.breakdown || []).forEach(item => {
        const subject = normalizeSubject(item.subject || attempt.subject) || subjectId;
        const marks = Number(item.marks) || 1;
        const earned = item.correct ? marks : 0;
        const ref = resolveContentRef(subject, item.topic, item.topics);

        if (!ref) {
          if (subject === subjectId) unattributed.push({ source: 'exam', name: item.topic, subject });
          return;
        }
        if (ref.subjectId !== subjectId) return; // belongs to the other subject

        if (ref.level === 'subtopic') {
          const sub = bucket(subtopicStats, ref.subtopicId);
          credit(sub, marks, earned, attempt.submittedAt);
          const topic = bucket(topicStats, ref.topicId);
          credit(topic, marks, earned, attempt.submittedAt);
        } else if (ref.level === 'topic') {
          credit(bucket(topicStats, ref.topicId), marks, earned, attempt.submittedAt);
        } else if (ref.level === 'chapter') {
          credit(bucket(chapterMixedStats, ref.chapterId), marks, earned, attempt.submittedAt);
        } else {
          credit(subjectMixedStats, marks, earned, attempt.submittedAt);
        }
      });
    });

    // ── Fold in AI workboard practice attempts ───────────────────────────
    // Each practice attempt is one AI-graded question, so it counts as a single
    // mark worth `score` percent — comparable to one exam question regardless
    // of the mark weighting of a real paper.
    practiceAttempts.forEach(attempt => {
      const subject = normalizeSubject(attempt.subject) || subjectId;
      const ref = resolveContentRef(subject, attempt.topicName, attempt.topics);

      if (!ref) {
        if (subject === subjectId) unattributed.push({ source: 'practice', name: attempt.topicName, subject });
        return;
      }
      if (ref.subjectId !== subjectId) return;

      const score = Math.max(0, Math.min(100, Number(attempt.score) || 0));
      const earned = score / 100;

      if (ref.level === 'subtopic') {
        credit(bucket(subtopicStats, ref.subtopicId), 1, earned, attempt.timestamp);
        credit(bucket(topicStats, ref.topicId), 1, earned, attempt.timestamp);
      } else if (ref.level === 'topic') {
        credit(bucket(topicStats, ref.topicId), 1, earned, attempt.timestamp);
      } else if (ref.level === 'chapter') {
        credit(bucket(chapterMixedStats, ref.chapterId), 1, earned, attempt.timestamp);
      } else {
        credit(subjectMixedStats, 1, earned, attempt.timestamp);
      }
    });

    // ── Assemble the annotated tree ──────────────────────────────────────
    const chapters = listChapters(subjectId).map(chapter => {
      const topics = chapter.topics.map(topic => {
        const topicCoverage = coverage?.topics[topic.id] || emptyCoverage();
        const subtopics = topic.subtopics.map(subtopic => ({
          id: subtopic.id,
          name: subtopic.name,
          coverage: coverage?.subtopics[subtopic.id] || emptyCoverage(),
          stats: finalise(subtopicStats[subtopic.id] || emptyStats()),
        }));

        const stats = finalise(topicStats[topic.id] || emptyStats());

        return {
          id: topic.id,
          name: topic.name,
          difficulty: topic.difficulty || 'Intermediate',
          coverage: topicCoverage,
          // Two separate questions, answered separately on the outline: is there
          // anything to practise, and is there an exam paper to sit? A topic can
          // honestly answer yes to one and no to the other.
          available: topicCoverage.total > 0,
          practiceAvailable: topicCoverage.practice > 0,
          examAvailable: topicCoverage.examTotal > 0,
          stats,
          subtopics,
        };
      });

      const mixed = finalise(chapterMixedStats[chapter.id] || emptyStats());
      // Chapter accuracy blends per-topic rollups with anything that matched
      // the chapter directly, so a chapter looks weak if either is weak.
      const stats = mergeStats(
        ...topics.map(t => t.stats),
        mixed.total ? mixed : null
      );

      const topicsWithContent = topics.filter(t => t.available).length;
      const topicsStarted = topics.filter(t => t.stats.total > 0).length;
      const topicsMastered = topics.filter(t => t.stats.status === 'mastered').length;

      return {
        id: chapter.id,
        name: chapter.name,
        icon: chapter.icon,
        coverage: coverage?.chapters[chapter.id] || emptyCoverage(),
        topics,
        topicsTotal: topics.length,
        topicsStarted,
        topicsWithContent,
        topicsMastered,
        mixed,
        stats,
        status: stats.status,
      };
    });

    const allTopics = chapters.flatMap(c => c.topics);
    const allSubtopics = allTopics.flatMap(t => t.subtopics);
    const chapterStats = chapters.map(c => c.stats);
    const stats = mergeStats(...chapterStats, subjectMixedStats.total ? subjectMixedStats : null);

    subjects[subjectId] = {
      id: subjectId,
      name: subject.name,
      icon: subject.icon,
      color: subject.color,
      accent: subject.accent,
      description: subject.description,
      chapters,
      stats,
      // Work that resolved to the subject but no more specific place (paper-level
      // tags). Counted in `stats` so it is never lost, and surfaced so the UI can
      // say so rather than quietly inflating an arbitrary chapter.
      mixed: subjectMixedStats,
      subjectLevelCoverage: coverage?.subjectLevel || emptyCoverage(),
      unattributed: coverage?.unattributed || { exam: 0, scenario: 0, practice: 0, items: [] },
      topicsTotal: allTopics.length,
      topicsWithContent: allTopics.filter(t => t.available).length,
      topicsStarted: allTopics.filter(t => t.stats.total > 0).length,
      topicsMastered: allTopics.filter(t => t.stats.status === 'mastered').length,
      topicsNeedingWork: allTopics.filter(t => t.stats.status === 'learning').length,
      subtopicsTotal: allSubtopics.length,
      subtopicsStarted: allSubtopics.filter(s => s.stats.total > 0).length,
    };
  });

  const everyTopic = Object.values(subjects).flatMap(s => s.chapters.flatMap(c => c.topics));
  const overall = {
    accuracy: mergeStats(...Object.values(subjects).map(s => s.stats)).accuracy,
    topicsTotal: everyTopic.length,
    topicsStarted: everyTopic.filter(t => t.stats.total > 0).length,
    topicsMastered: everyTopic.filter(t => t.stats.status === 'mastered').length,
    topicsWithContent: everyTopic.filter(t => t.available).length,
  };
  overall.coverage = overall.topicsTotal > 0
    ? Math.round((overall.topicsStarted / overall.topicsTotal) * 100)
    : 0;

  return { overall, subjects, unattributed };
}

// ─── Lookups used by the UI ─────────────────────────────────────────────────

// Topics that need attention, worst first. Drives the "Needs work" filter and
// the continue-studying call to action.
export function topicsNeedingAttention(progress, subjectId) {
  const subject = progress?.subjects?.[subjectId];
  if (!subject) return [];
  return flattenTopics(subject)
    .filter(t => t.stats.total > 0 && t.stats.status !== 'mastered')
    .sort((a, b) => a.stats.accuracy - b.stats.accuracy);
}

// The single next thing to practise: available, not started, earliest in the
// syllabus. Returns null when everything available has been started.
export function nextTopicToStudy(progress, subjectId) {
  const subject = progress?.subjects?.[subjectId];
  if (!subject) return null;
  const flat = flattenTopics(subject);
  return (
    flat.find(t => t.available && t.stats.total === 0)
    || flat.find(t => t.available && t.stats.status !== 'mastered')
    || null
  );
}

// Annotated topics, flattened with their chapter/subject context attached so
// callers can link straight to a topic without re-deriving the path.
function flattenTopics(subject) {
  return subject.chapters.flatMap(c =>
    c.topics.map(t => ({
      ...t,
      topicId: t.id,
      topicName: t.name,
      chapterId: c.id,
      chapterName: c.name,
      subjectId: subject.id,
    }))
  );
}

// Looks up the annotated (stats-carrying) topic inside a computed progress tree.
// Falls back to the raw outline when no progress has been computed yet.
export function findTopicProgress(progress, subjectId, topicId) {
  const subject = progress?.subjects?.[subjectId];
  const chapter = subject?.chapters.find(c => c.topics.some(t => t.id === topicId));
  if (!chapter) return null;
  const topic = chapter.topics.find(t => t.id === topicId);
  return topic ? { chapter, topic } : null;
}

export { SUBJECT_IDS, SYLLABUS, countSubtopics, countTopics, listTopics };
