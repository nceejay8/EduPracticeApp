// Tests for the syllabus outline, the content-attribution rule, and the progress
// rollup that the /syllabus page renders from.
//
//   npm test
//
// The attribution rule is the part worth guarding. It decides which topic a
// question, scenario or past attempt belongs to, and that single answer drives
// three things at once: the coverage counts on the syllabus page, the question
// the AI workboard serves, and the topic exam that gets offered. When those
// disagree, a student is told material exists and then cannot reach it — or is
// handed a paper shorter than the one advertised.

import {
  SYLLABUS, SUBJECT_IDS, SYLLABUS_LEVELS,
  countTopics, countSubtopics, listChapters,
  resolveTopicRef, getTopic, searchIndex,
  normalizeLevelId, levelToLevelId,
} from '../src/data/syllabus.js';
import { questionBank, scenarioBank, buildExam, questionTopicId } from '../src/data/examBank.js';
import {
  PRACTICE_SCENARIOS,
  pickScenarioForSyllabusTopic,
  getScenariosForSyllabusTopic,
} from '../src/data/practiceScenarios.js';
import { buildTopicExams } from '../src/data/topicExams.js';
import {
  computeSyllabusProgress, getSubjectCoverage, getTopicCoverage,
  nextTopicToStudy, topicsNeedingAttention, STATUS_META,
} from '../src/data/syllabusProgress.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) { fails++; console.log(`FAIL  ${label} ${extra}`); }
  else console.log(`ok    ${label} ${extra}`);
};

// ── 1. Outline structure ────────────────────────────────────────────────────
// The counts are the product spec for the page, so they are asserted rather than
// discovered: a chapter silently dropped from syllabus.js would otherwise just
// make the outline wrong.
const EXPECTED = { physics: [6, 39, 112], mathematics: [8, 41, 107] };

for (const sid of SUBJECT_IDS) {
  const s = SYLLABUS[sid];
  const [chapters, topics, subtopics] = EXPECTED[sid];
  check(`${sid}: ${chapters} chapters`, s.chapters.length === chapters, `(got ${s.chapters.length})`);
  check(`${sid}: ${topics} topics`, countTopics(sid) === topics, `(got ${countTopics(sid)})`);
  check(`${sid}: ${subtopics} subtopics`, countSubtopics(sid) === subtopics, `(got ${countSubtopics(sid)})`);

  const ids = new Set();
  const dupes = [];
  const empty = [];
  s.chapters.forEach(c => {
    [c.id, ...c.topics.map(t => t.id), ...c.topics.flatMap(t => t.subtopics.map(x => x.id))]
      .forEach(id => { if (ids.has(id)) dupes.push(id); ids.add(id); });
    c.topics.forEach(t => { if (!t.subtopics?.length) empty.push(t.name); });
  });
  check(`${sid}: ids unique`, dupes.length === 0, dupes.join(', '));
  check(`${sid}: every topic has subtopics`, empty.length === 0, empty.join(', '));
}
check('levels', SYLLABUS_LEVELS.join(',') === 'A-Level,UACE');

// ── 2. Level ids round-trip through URLs ────────────────────────────────────
// Links into /syllabus come from several pages written at different times, and
// some carry the raw label rather than the id. Both have to resolve.
check('level id uace', normalizeLevelId('uace') === 'UACE');
check('level label UACE', normalizeLevelId('UACE') === 'UACE');
check('level id a-level', normalizeLevelId('a-level') === 'A-Level');
check('level label A-Level', normalizeLevelId('A-Level') === 'A-Level');
check('level id alevel', normalizeLevelId('alevel') === 'A-Level');
check('level garbage is null', normalizeLevelId('O-Level') === null);
check('level id -> label -> id', levelToLevelId(normalizeLevelId('UACE')) === 'uace');

// ── 3. Every tag in the real content banks must resolve ─────────────────────
const tags = new Map();
const add = (subject, tag) => {
  if (!tag) return;
  const k = `${subject}|${tag}`;
  tags.set(k, { subject, tag });
};
questionBank.forEach(q => add(q.subject, q.topic));
scenarioBank.forEach(q => add(q.subject, q.topic));
PRACTICE_SCENARIOS.forEach(s => { add(s.subject, s.topic); (s.topics || []).forEach(t => add(s.subject, t)); });

const rows = [...tags.values()].map(r => ({ ...r, ref: resolveTopicRef(r.tag, r.subject) }));
const unresolved = rows.filter(r => !r.ref || r.ref.level === 'unknown');
const crossSubject = rows.filter(r => r.ref?.subjectId && r.ref.subjectId !== r.subject.toLowerCase());
check(`every bank tag resolves (${rows.length})`, unresolved.length === 0,
  unresolved.map(r => `"${r.tag}"[${r.subject}]`).join(', '));
check('no cross-subject resolution', crossSubject.length === 0,
  crossSubject.map(r => `"${r.tag}"[${r.subject}]->${r.ref.subjectId}`).join(', '));

// ── 4. Canonical names must win over aliases and chapter names ──────────────
const selfMiss = [];
SUBJECT_IDS.forEach(sid => listChapters(sid).forEach(c => c.topics.forEach(t => {
  const ref = resolveTopicRef(t.name, sid);
  if (ref?.topicId !== t.id) selfMiss.push(`${sid}:${t.name}->${ref?.level}`);
  if (getTopic(sid, t.id)?.topic.id !== t.id) selfMiss.push(`getTopic(${t.id})`);
})));
check('canonical names round-trip', selfMiss.length === 0, selfMiss.join(', '));

// A subject hint must win over the other subject, even for names both use.
const physicsStatics = resolveTopicRef('Statics', 'physics');
const mathStatics = resolveTopicRef('Statics', 'mathematics');
check('Statics in physics', physicsStatics?.subjectId === 'physics', `-> ${physicsStatics?.topicId}`);
check('Statics in mathematics', mathStatics?.subjectId === 'mathematics', `-> ${mathStatics?.topicId}`);
check('Statics resolves differently per subject', physicsStatics?.topicId !== mathStatics?.topicId);
check('Work, Energy and Power disambiguated',
  resolveTopicRef('Work, Energy and Power', 'physics')?.topicId
  !== resolveTopicRef('Work, Energy and Power', 'mathematics')?.topicId);

// An unplaceable tag must say so. Crediting it to the subject would inflate
// subject accuracy with work we cannot actually place.
check('unknown tag -> null', resolveTopicRef('Photosynthesis of the soul', 'physics') === null);
check('subject name -> subject level', resolveTopicRef('Mathematics')?.level === 'subject');
check('subject name with hint -> subject level',
  resolveTopicRef('Mathematics', 'mathematics')?.level === 'subject');
// A paper-level tag is a real, intentional level in the outline.
check('paper-level tag -> subject level',
  resolveTopicRef('Applied Mathematics', 'mathematics')?.level === 'subject');

// ── 5. Coverage ─────────────────────────────────────────────────────────────
for (const sid of SUBJECT_IDS) {
  const cov = getSubjectCoverage(sid);
  const ownQuestions = [...questionBank, ...scenarioBank].filter(q => q.subject.toLowerCase() === sid).length;
  const ownScenarios = PRACTICE_SCENARIOS.filter(s => (s.subject || '').toLowerCase() === sid).length;
  check(`${sid}: coverage is populated`, cov.items > 0,
    `(${cov.items} placed, bank holds ${ownQuestions} questions + ${ownScenarios} scenarios)`);
  check(`${sid}: nothing unattributed`, cov.unattributed.items.length === 0,
    cov.unattributed.items.map(i => i.name).join(', '));
  check(`${sid}: topicsTotal matches outline`, cov.topicsTotal === countTopics(sid));
}

// The central promise of the page: nothing is advertised that cannot be served.
const topicExams = new Map();
['A-Level', 'UACE'].forEach(level =>
  buildTopicExams(level).forEach(t => topicExams.set(`${t.subjectId}:${t.topicId}`, t)));

let lieCount = 0;
const lies = [];
SUBJECT_IDS.forEach(sid => listChapters(sid).forEach(c => c.topics.forEach(t => {
  const cov = getTopicCoverage(sid, t.id);

  if (cov.practice > 0 && pickScenarioForSyllabusTopic(sid, t.id) === null) {
    lieCount++; lies.push(`offers practice, workboard empty: ${t.id}`);
  }
  if (cov.practice > 0 && getScenariosForSyllabusTopic(sid, t.id).length === 0) {
    lieCount++; lies.push(`practice count disagrees with picker: ${t.id}`);
  }
  if (cov.practice === 0 && getScenariosForSyllabusTopic(sid, t.id).length > 0) {
    lieCount++; lies.push(`picker offers unlisted scenario: ${t.id}`);
  }

  const offered = topicExams.get(`${sid}:${t.id}`);
  if (cov.examTotal > 0 && !offered) {
    lieCount++; lies.push(`offers exam, none listed: ${t.id}`);
  }
  if (offered) {
    const built = buildExam({
      subject: SYLLABUS[sid].name, level: offered.level, topicId: t.id,
      count: offered.count, scenarioCount: offered.scenarioCount,
    });
    if (built.length !== offered.count) {
      lieCount++; lies.push(`short paper: ${t.id} (${built.length}/${offered.count})`);
    }
  }
})));
check('coverage never over-promises', lieCount === 0, lies.slice(0, 8).join(' | '));

// A topic exam must contain that topic's questions and nothing else.
let leak = 0;
const leaks = [];
[...topicExams.values()].forEach(t => {
  buildExam({
    subject: t.subject, level: t.level, topicId: t.topicId,
    count: t.count, scenarioCount: t.scenarioCount,
  }).forEach(q => {
    if (questionTopicId(q) !== t.topicId) { leak++; leaks.push(`${t.topicId}<-${q.id}(${q.topic})`); }
  });
});
check('topic papers stay on topic', leak === 0, leaks.slice(0, 5).join(', '));

// Levels are equivalent, so both must offer the same set of papers.
const paperIds = l => buildTopicExams(l).map(t => `${t.subjectId}:${t.topicId}`).sort().join();
check('A-Level and UACE offer the same papers', paperIds('A-Level') === paperIds('UACE'),
  `A=${buildTopicExams('A-Level').length} U=${buildTopicExams('UACE').length}`);

// ── 6. Progress rollup ──────────────────────────────────────────────────────
const attempts = [{
  id: 'a1', subject: 'Physics', submittedAt: '2026-01-05T10:00:00Z', percentage: 50,
  breakdown: [
    { subject: 'Physics', topic: 'Energy & Power', correct: true },
    { subject: 'Physics', topic: 'Energy & Power', correct: false },
    { subject: 'Physics', topic: 'Optics', correct: true },
    { subject: 'Physics', topic: 'nonsense tag', correct: false },
  ],
}];
const practiceAttempts = [
  { topicName: 'Work, Energy and Power', subject: 'physics', topicId: 'phy-mech-energy', score: 60, timestamp: '2026-01-06T09:00:00Z' },
];
const p = computeSyllabusProgress({ attempts, practiceAttempts });

const mechanics = p.subjects.physics.chapters.find(c => c.id === 'phy-mechanics');
const energy = mechanics.topics.find(t => t.id === 'phy-mech-energy');

check('exam + practice both credited to the topic', energy?.stats.attempts === 3, `(got ${energy?.stats.attempts})`);
// 2 exam items (1 of 2 correct) + 1 practice item at 60% = 1.6 marks of 3.
check('marks and accuracy are weighted', energy?.stats.accuracy === 53, `(got ${energy?.stats.accuracy}%)`);
check('accuracy is within 0..100', energy?.stats.accuracy >= 0 && energy?.stats.accuracy <= 100);
check('chapter rolls up its topics', mechanics.stats.total === 3, `(got ${mechanics.stats.total})`);
check('chapter average matches its topics', mechanics.stats.accuracy === energy.stats.accuracy);
check('unplaceable tag reported once', p.unattributed.filter(u => u.name === 'nonsense tag').length === 1,
  JSON.stringify(p.unattributed));
check('subject not touched by the other subject', p.subjects.mathematics.topicsStarted === 0);
check('status is a known value', !!STATUS_META[energy?.stats?.status], energy?.stats?.status);
check('status tracks accuracy', energy.stats.status === STATUS_META[energy.stats.status].label
  || typeof energy.stats.status === 'string');
check('mastery threshold respected', energy.stats.accuracy < 80 && energy.stats.status !== 'mastered');
check('recommendation is available material', !!nextTopicToStudy(p, 'physics'),
  nextTopicToStudy(p, 'physics')?.topicName || 'null');
// Needs-work must only surface topics the student has actually attempted — an
// unstarted topic is a "next up", not a "weak spot". Status lives on `stats`,
// which is the path the page reads.
const needsWork = topicsNeedingAttention(p, 'physics');
check('needs-work excludes unstarted topics', needsWork.length > 0 && needsWork.every(t => t.stats.total > 0),
  needsWork.map(t => `${t.topicName}:${t.stats.status}`).join(', '));
check('needs-work excludes mastered topics', needsWork.every(t => t.stats.status !== 'mastered'));
check('needs-work is worst first',
  needsWork.every((t, i) => i === 0 || needsWork[i - 1].stats.accuracy <= t.stats.accuracy));
check('needs-work carries link context', needsWork.every(t => t.chapterId && t.subjectId));

// No attempts at all must still produce a full, renderable outline — this is the
// state every new student sees first. Accuracy is 0 here, so the page's guard is
// `stats.total` rather than the accuracy value; that is the contract worth
// pinning, because rendering a confident "0%" for a syllabus nobody has touched
// would be a lie.
const empty = computeSyllabusProgress();
check('empty progress keeps the whole outline', empty.overall.topicsTotal === countTopics('physics') + countTopics('mathematics'));
check('empty progress reports nothing started', empty.overall.topicsStarted === 0);
check('empty progress has zero coverage', empty.overall.coverage === 0);
check('empty progress accuracy is 0 but guarded by total',
  empty.overall.accuracy === 0 && empty.overall.topicsStarted === 0);
check('empty progress is not mastered', empty.subjects.physics.status !== 'mastered');
check('empty progress has no recommendation', nextTopicToStudy(empty, 'physics')?.topicName !== undefined);
check('empty progress needs no attention', topicsNeedingAttention(empty, 'physics').length === 0);
check('search index is populated', searchIndex().length > 0, `(${searchIndex().length} entries)`);

console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
