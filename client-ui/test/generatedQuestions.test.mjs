// Tests for the daily question generator's policy: validation, topic ranking,
// id scheme, and JSON parsing.
//
//   npm test
//
// These are the rules that decide what a student may eventually be served, and
// every one of them runs without a network, a key, or the database — the parts
// that need those (callGenerate, insertRows) are deliberately thin pass-throughs
// covered by the ai-proxy contract instead.
//
// Plain Node, same harness as the other suites — no framework.

import {
  CAP_PER_TOPIC,
  buildQuestionId,
  buildRow,
  canInsert,
  dayStamp,
  nextSequence,
  parseModelJson,
  rankTopics,
  readEnv,
  validateRow,
} from '../scripts/generate-questions.mjs';
import { listTopics } from '../src/data/syllabus.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) { fails++; console.log(`FAIL  ${label} ${extra}`); }
  else console.log(`ok    ${label} ${extra}`);
};

// A real topic from the canonical outline, so attribution is tested against
// the actual syllabus rather than a fixture that could drift from it.
const topic = listTopics('physics').find(t => t.id === 'phy-mech-equilibrium');
const chapterOnlyName = 'Mechanics'; // a chapter name that is not any topic name

const VALID_MODEL = {
  stem: 'A crate of mass 25 kg rests on a rough horizontal floor with coefficient of friction 0.4. A horizontal force is then applied. Take g = 10 m/s².',
  difficulty: 2,
  parts: [
    { label: '(a)', text: 'Calculate the maximum static friction.', marks: 3 },
    { label: '(b)', text: 'Find the acceleration under a 150 N force.', marks: 3 },
  ],
  mark_scheme: [
    { criterion: 'f = μR = 0.4 × 25 × 10 = 100 N', marks: 3, max: 3 },
    { criterion: 'a = (150 − 100) / 25 = 2.0 m/s²', marks: 3, max: 3 },
  ],
};

const makeRow = (overrides = {}) => {
  const base = buildRow(VALID_MODEL, {
    subjectId: 'physics',
    id: topic.id,
    name: topic.name,
    chapterId: topic.chapterId,
    chapterName: topic.chapterName,
  }, { stamp: '20261007', seq: 1, runId: 'test' });
  return { ...base, ...overrides };
};

// ═══ validateRow: the happy path ═══════════════════════════════════════════
{
  check('a well-formed row validates', validateRow(makeRow()).ok === true);
  check('id follows the gen-<date>-<topic>-<nn> scheme',
    makeRow().id === 'gen-20261007-phy-mech-equilibrium-01', makeRow().id);
}

// ═══ validateRow: attribution ══════════════════════════════════════════════
// An unattributed question still gets served by the workboard while being
// invisible on /syllabus — the two views would quietly disagree.
{
  const r = validateRow(makeRow({ topic_id: 'phy-does-not-exist' }));
  check('mismatched topic_id refused', r.ok === false && /resolves to/.test(r.reason), r.reason);

  const r2 = validateRow(makeRow({ topic: 'Underwater Basket Weaving', topics: [] }));
  check('unresolvable topic refused', r2.ok === false && /does not resolve/.test(r2.reason), r2.reason);

  // With the chapter tag left in, an unknown topic still must not slip through:
  // the tag resolves at chapter level, which validation also refuses.
  const r2b = validateRow(makeRow({ topic: 'Underwater Basket Weaving' }));
  check('unknown topic falling back to chapter tag refused',
    r2b.ok === false && /chapter level/.test(r2b.reason), r2b.reason);

  const r3 = validateRow(makeRow({ topic: chapterOnlyName }));
  check('chapter-level topic refused', r3.ok === false && /chapter level/.test(r3.reason), r3.reason);

  const r4 = validateRow(makeRow({ subject: 'chemistry' }));
  check('unknown subject refused', r4.ok === false && /unknown subject/.test(r4.reason), r4.reason);

  const r5 = validateRow(makeRow({ level: 'O-Level' }));
  check('unknown level refused', r5.ok === false && /unknown level/.test(r5.reason), r5.reason);
}

// ═══ validateRow: structure ════════════════════════════════════════════════
{
  const r = validateRow(makeRow({ stem: 'Too short.' }));
  check('short stem refused', r.ok === false && /stem/.test(r.reason), r.reason);

  const r2 = validateRow(makeRow({ difficulty: 4 }));
  check('difficulty out of range refused', r2.ok === false && /outside 1-3/.test(r2.reason), r2.reason);

  const r3 = validateRow(makeRow({ difficulty: '2' }));
  check('non-integer difficulty refused', r3.ok === false && /outside 1-3/.test(r3.reason), r3.reason);

  const r4 = validateRow(makeRow({ parts: [VALID_MODEL.parts[0]] }));
  check('single-part question refused', r4.ok === false && /2-6 parts/.test(r4.reason), r4.reason);

  const r5 = validateRow(makeRow({
    parts: [{ label: '(a)', text: 'x', marks: 0 }, { label: '(b)', text: 'y', marks: 3 }],
    total_marks: 3,
    mark_scheme: [{ criterion: 'c', marks: 3, max: 3 }],
  }));
  check('zero-mark part refused', r5.ok === false && /integer from 1 to 15/.test(r5.reason), r5.reason);

  const r6 = validateRow(makeRow({
    parts: [{ label: '(a)', text: 'x', marks: 2.5 }, { label: '(b)', text: 'y', marks: 3 }],
    total_marks: 5,
    mark_scheme: [{ criterion: 'c', marks: 5, max: 5 }],
  }));
  check('fractional marks refused', r6.ok === false && /integer from 1 to 15/.test(r6.reason), r6.reason);

  const r7 = validateRow(makeRow({ mark_scheme: [] }));
  check('empty mark scheme refused', r7.ok === false && /mark scheme is empty/.test(r7.reason), r7.reason);
}

// ═══ validateRow: marks must agree with themselves ═════════════════════════
// The failure the Review Queue warns about must never survive generation.
{
  const r = validateRow(makeRow({
    mark_scheme: [
      { criterion: 'a', marks: 3, max: 4 },
      { criterion: 'b', marks: 3, max: 3 },
    ],
  }));
  check('mark scheme sum mismatch refused', r.ok === false && /awards 7 but the parts total 6/.test(r.reason), r.reason);

  const r2 = validateRow(makeRow({
    mark_scheme: [
      { criterion: 'a', marks: 4, max: 3 },
      { criterion: 'b', marks: 3, max: 3 },
    ],
  }));
  check('criterion over-awarding refused', r2.ok === false && /must be an integer from 0 to 3/.test(r2.reason), r2.reason);

  const r3 = validateRow(makeRow({ total_marks: 99 }));
  check('stored total disagreement refused', r3.ok === false && /total_marks 99/.test(r3.reason), r3.reason);
}

// ═══ canInsert ═════════════════════════════════════════════════════════════
// A row the table's constraints would reject cannot be stored even as a
// rejected record, so the run skips it instead of dying on the insert.
{
  check('a valid row is insertable', canInsert(makeRow()) === true);
  check('NaN difficulty is not insertable', canInsert(makeRow({ difficulty: NaN })) === false);
  check('missing id is not insertable', canInsert(makeRow({ id: '' })) === false);
  check('string total is not insertable', canInsert(makeRow({ total_marks: 'six' })) === false);
}

// ═══ rankTopics ════════════════════════════════════════════════════════════
{
  const physics = listTopics('physics').map(t => ({
    subjectId: 'physics', id: t.id, name: t.name, chapterName: t.chapterName,
  }));
  const math = listTopics('mathematics').map(t => ({
    subjectId: 'mathematics', id: t.id, name: t.name, chapterName: t.chapterName,
  }));
  const all = [...physics, ...math];

  // At the cap means published + pending reaches CAP_PER_TOPIC. A rejected row
  // is retired content and must not eat the slot.
  const counts = new Map([
    [physics[0].id, { published: 9, pending: 1 }],
    [physics[1].id, { published: 12, pending: 0 }],
    [physics[2].id, { published: 0, pending: 0, rejected: 7 }],
  ]);
  const picked = rankTopics(all, counts, 100, 1000);
  check('topic at the cap is skipped', !picked.some(p => p.id === physics[0].id));
  check('topic over the cap is skipped', !picked.some(p => p.id === physics[1].id));
  check('rejected rows do not consume the cap', picked.some(p => p.id === physics[2].id));
  check('eligible pool reported', picked.length === all.length - 2, `got ${picked.length}`);

  const thinnest = rankTopics(
    [physics[0], physics[1]].map(t => ({ ...t })),
    new Map([[physics[0].id, { published: 9, pending: 0 }], [physics[1].id, { published: 1, pending: 0 }]]),
    100, 2,
  );
  check('thinnest topic first', thinnest[0].id === physics[1].id,
    JSON.stringify(thinnest.map(t => t.usable)));

  // Subjects interleave so a run can never drain one subject before starting
  // the other: expect exactly physics, mathematics, physics, mathematics…
  const interleaved = rankTopics(
    [...physics.slice(0, 2), ...math.slice(0, 2)],
    new Map(), 100, 4,
  );
  check('subjects alternate in the picks',
    interleaved.map(t => t.subjectId).join(',') === 'physics,mathematics,physics,mathematics',
    interleaved.map(t => t.subjectId).join(','));

  check('limit is respected', rankTopics(all, new Map(), 100, 7).length === 7);
  check('ranking is deterministic for a day',
    JSON.stringify(rankTopics(all, counts, 100, 7).map(t => t.id))
    === JSON.stringify(rankTopics(all, counts, 100, 7).map(t => t.id)));
  check('cap constant is 10', CAP_PER_TOPIC === 10);
}

// ═══ Id scheme and sequences ═══════════════════════════════════════════════
{
  check('date stamp is UTC yyyymmdd', dayStamp(new Date(Date.UTC(2026, 9, 7))) === '20261007');
  check('id pads the sequence', buildQuestionId('20261007', 'phy-mech-energy', 7) === 'gen-20261007-phy-mech-energy-07');
  check('sequence continues after existing rows',
    nextSequence(new Map([['20261007-phy-mech-energy', 3]]), '20261007', 'phy-mech-energy') === 4);
  check('sequence starts at 1 with no history', nextSequence(new Map(), '20261007', 'phy-mech-energy') === 1);
}

// ═══ parseModelJson ════════════════════════════════════════════════════════
{
  check('plain JSON parses', parseModelJson('{"a":1}')?.a === 1);
  check('fenced JSON parses', parseModelJson('```json\n{"a":1}\n```')?.a === 1);
  check('bare fence parses', parseModelJson('```\n{"a":1}\n```')?.a === 1);
  check('prose around JSON parses', parseModelJson('Here is the question: {"a":1} — enjoy!')?.a === 1);
  check('garbage returns null', parseModelJson('no json here') === null);
  check('truncated JSON returns null', parseModelJson('{"a": 1') === null);
  check('non-string returns null', parseModelJson(null) === null);
}

// ═══ buildRow ══════════════════════════════════════════════════════════════
{
  const mTopic = listTopics('mathematics')[0];
  const row = buildRow(VALID_MODEL, {
    subjectId: 'mathematics',
    id: mTopic.id,
    name: mTopic.name,
    chapterId: mTopic.chapterId,
    chapterName: mTopic.chapterName,
  }, { stamp: '20261007', seq: 2, runId: 'gh-1' });

  check('row carries the composed id', row.id === `gen-20261007-${mTopic.id}-02`, row.id);
  check('row derives subject from the slot', row.subject === 'mathematics');
  check('row pins the level', row.level === 'UACE');
  check('row starts pending', row.status === 'pending');
  check('row carries the run id', row.run_id === 'gh-1');
  check('total_marks computed from parts', row.total_marks === 6, String(row.total_marks));
  check('built row validates', validateRow(row).ok === true);

  // Junk the database's CHECK would refuse (difficulty NaN) fails validation
  // and cannot be stored even as a rejected row — the run logs and skips those
  // rather than dying on the insert.
  const junk = buildRow({ ...VALID_MODEL, difficulty: 'hard' }, {
    subjectId: 'physics', id: topic.id, name: topic.name, chapterId: topic.chapterId, chapterName: topic.chapterName,
  }, { stamp: '20261007', seq: 1, runId: 'test' });
  check('junk difficulty fails validation', validateRow(junk).ok === false);
  check('junk difficulty is not insertable', canInsert(junk) === false);

  const noParts = buildRow({ stem: VALID_MODEL.stem }, {
    subjectId: 'physics', id: topic.id, name: topic.name, chapterId: topic.chapterId, chapterName: topic.chapterName,
  }, { stamp: '20261007', seq: 1, runId: 'test' });
  check('missing parts fails validation', validateRow(noParts).ok === false);
  check('missing difficulty is not insertable', canInsert(noParts) === false);
}

// ═══ readEnv ═══════════════════════════════════════════════════════════════
{
  const ok = readEnv({
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'a',
    SUPABASE_SERVICE_ROLE_KEY: 's',
    GENERATOR_SECRET: 'g',
  });
  check('complete env accepted', ok.SUPABASE_URL === 'https://x.supabase.co');

  let threw = '';
  try { readEnv({ SUPABASE_URL: 'https://x.supabase.co' }); } catch (e) { threw = e.message; }
  check('missing env names every variable',
    /SUPABASE_ANON_KEY/.test(threw) && /GENERATOR_SECRET/.test(threw), threw.slice(0, 80));
}

console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
