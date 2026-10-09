// Daily practice-question generator.
//
//   node scripts/generate-questions.mjs [--limit N] [--dry-run]
//
// Runs from .github/workflows/generate-questions.yml once a day. It picks the
// thinnest syllabus topics, asks Gemini (through the ai-proxy Edge Function) for
// one multi-part UACE question each, verifies the result, and upserts the rows
// into practice_questions as `pending`. Nothing reaches a student until an
// admin approves it in /admin's Review Queue.
//
// Division of responsibility:
//   ai-proxy   — holds the Gemini key and enforces who may call it.
//   THIS file  — generation policy: which topics, how many, the per-topic cap,
//                what counts as valid, numeric verification. Policy lives here
//                so it can be unit tested (test/generatedQuestions.test.mjs)
//                without a network or a key.
//
// Credentials come from the environment, never from VITE_* vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY   — invoke the Edge Function (both public)
//   SUPABASE_SERVICE_ROLE_KEY         — upsert past RLS; CI secret only
//   GENERATOR_SECRET                  — shared with the Edge Function
//
// Idempotency: ids are gen-<YYYYMMDD>-<topicId>-<nn>, and rows whose ids
// already exist are skipped, not overwritten — a re-run after a mid-run failure
// fills in what is missing, and a same-day re-run can never reset a question an
// admin has already reviewed.

import { pathToFileURL } from 'node:url';
import {
  SUBJECT_IDS,
  SYLLABUS_LEVELS,
  listTopics,
  resolveContentRef,
} from '../src/data/syllabus.js';

// ── Policy constants ────────────────────────────────────────────────────────

// The cap that keeps the pool from flooding a topic. It counts generated rows
// that are live or queued (published + pending): counting only published would
// let an unreviewed backlog push the eventual total past 10. Rejected rows are
// retired, not live, so they do not consume the cap. Built-in hand-authored
// scenarios are curated separately and are not the generator's business.
export const CAP_PER_TOPIC = 10;

export const DEFAULT_LIMIT = 50;

// 'UACE' is the label this pipeline was built for (both levels share one topic
// tree today — see SYLLABUS_LEVELS in syllabus.js).
const LEVEL = 'UACE';

const SOURCE = 'daily-generator';

// Structural failures get one fresh attempt before the row is recorded as
// rejected: a model occasionally drops a part under a long schema, and one
// retry is cheap next to shipping a hole in the queue. Numeric disagreements do
// NOT get a retry — re-asking until the verifier agrees would turn verification
// into a coin flip.
const STRUCTURAL_RETRIES = 1;

const MAX_PROXY_RETRIES = 4;
const SLEEP_BETWEEN_CALLS_MS = 250;

// ── Small pure helpers (exported for tests) ─────────────────────────────────

export function readEnv(env = process.env) {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GENERATOR_SECRET',
  ];
  const missing = required.filter(k => !env[k]);
  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. ` +
      'In GitHub Actions these are repository secrets; locally, export them or run ' +
      'with `node --env-file=.env.local scripts/generate-questions.mjs`.',
    );
  }
  return {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    GENERATOR_SECRET: env.GENERATOR_SECRET,
  };
}

// UTC date stamp, so the id scheme does not depend on the runner's timezone.
export function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function buildQuestionId(stamp, topicId, n) {
  return `gen-${stamp}-${topicId}-${String(n).padStart(2, '0')}`;
}

// How many questions a topic already has for `stamp`. Walked from the existing
// id set so sequences continue instead of colliding when a run is retried.
export function nextSequence(prefixCounts, stamp, topicId) {
  return (prefixCounts.get(`${stamp}-${topicId}`) ?? 0) + 1;
}

// Structured output arrives as JSON text, but a stray fence or prose around it
// has been seen in the wild; take the outermost object rather than failing a
// whole question over formatting.
export function parseModelJson(text) {
  if (typeof text !== 'string') return null;
  let body = text.trim();
  const fence = body.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) body = fence[1];
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Deterministic tie-break so "thinnest topic" does not always mean "first in
// alphabetical order" — otherwise the same handful of topics would absorb every
// tie forever. Seeded with the day number, so each day rotates the ties while a
// re-run on the same day stays reproducible.
function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Validation ──────────────────────────────────────────────────────────────

// The gate every row passes before it may sit in the pending queue. This is a
// backstop below the prompt, not a substitute for it: it refuses anything that
// would render badly, misattribute coverage, or disagree with itself about how
// many marks the question is worth.
//
// Returns { ok: true } or { ok: false, reason }. The reason is stored in
// reject_reason so the admin queue can explain why a row was never offered for
// review.
export function validateRow(row) {
  const fail = reason => ({ ok: false, reason });

  if (!row || typeof row !== 'object') return fail('row is not an object');

  if (!SUBJECT_IDS.includes(row.subject)) {
    return fail(`unknown subject "${row.subject}"`);
  }
  if (!SYLLABUS_LEVELS.includes(row.level)) {
    return fail(`unknown level "${row.level}"`);
  }

  // Attribution. resolveContentRef is the single rule the whole app uses for
  // "does this belong to this topic", and a question that resolves nowhere is
  // invisible on /syllabus while still being served by the workboard.
  if (typeof row.topic !== 'string' || !row.topic.trim()) return fail('missing topic');
  const ref = resolveContentRef(row.subject, row.topic, row.topics ?? null);
  if (!ref) return fail(`topic "${row.topic}" does not resolve in the ${row.subject} syllabus`);
  if (ref.level !== 'topic') {
    return fail(`topic "${row.topic}" resolves only to ${ref.level} level, not to a topic`);
  }
  if (ref.topicId !== row.topic_id) {
    return fail(`topic "${row.topic}" resolves to "${ref.topicId}", not "${row.topic_id}"`);
  }

  if (!Number.isInteger(row.difficulty) || row.difficulty < 1 || row.difficulty > 3) {
    return fail(`difficulty ${row.difficulty} is outside 1-3`);
  }

  // A stem shorter than this is almost always the model's preamble ("Here is
  // your question:") rather than a self-contained problem.
  if (typeof row.stem !== 'string' || row.stem.trim().length < 40) {
    return fail('stem missing or too short to be a real question');
  }

  const parts = row.parts;
  if (!Array.isArray(parts)) return fail('parts is not an array');
  if (parts.length < 2 || parts.length > 6) {
    return fail(`expected 2-6 parts (multi-part), got ${parts.length}`);
  }
  let partsTotal = 0;
  for (const part of parts) {
    if (!part || typeof part.text !== 'string' || !part.text.trim()) {
      return fail('a part has no text');
    }
    if (!Number.isInteger(part.marks) || part.marks < 1 || part.marks > 15) {
      return fail(`part marks ${part?.marks} must be an integer from 1 to 15`);
    }
    partsTotal += part.marks;
  }
  if (partsTotal < 4 || partsTotal > 60) {
    return fail(`total marks ${partsTotal} is outside 4-60`);
  }

  const scheme = row.mark_scheme;
  if (!Array.isArray(scheme) || scheme.length === 0) return fail('mark scheme is empty');
  let schemeTotal = 0;
  for (const criterion of scheme) {
    if (!criterion || typeof criterion.criterion !== 'string' || !criterion.criterion.trim()) {
      return fail('a mark scheme row has no criterion text');
    }
    if (!Number.isInteger(criterion.max) || criterion.max < 1) {
      return fail(`mark scheme max ${criterion?.max} must be a positive integer`);
    }
    if (!Number.isInteger(criterion.marks) || criterion.marks < 0 || criterion.marks > criterion.max) {
      return fail(`mark scheme marks ${criterion?.marks} must be an integer from 0 to ${criterion.max}`);
    }
    schemeTotal += criterion.max;
  }

  // The mark scheme must add up to the parts. AdminQuestionQueue computes this
  // same comparison and warns on it; enforcing it here means the warning should
  // never fire for generated content, and fires loudly for anything hand-edited.
  if (schemeTotal !== partsTotal) {
    return fail(`mark scheme awards ${schemeTotal} but the parts total ${partsTotal}`);
  }
  if (row.total_marks !== partsTotal) {
    return fail(`total_marks ${row.total_marks} does not match the parts total ${partsTotal}`);
  }

  return { ok: true };
}

// Shape check for the database's NOT NULL and CHECK constraints. A row that
// fails validation is still recorded as rejected (so the queue can show why),
// but a row the table would refuse cannot be recorded at all — those are logged
// and skipped rather than crashing the run.
export function canInsert(row) {
  return Boolean(
    row
    && typeof row.id === 'string' && row.id
    && typeof row.subject === 'string' && row.subject
    && typeof row.level === 'string' && row.level
    && typeof row.topic === 'string' && row.topic
    && typeof row.topic_id === 'string' && row.topic_id
    && typeof row.stem === 'string'
    && Number.isInteger(row.difficulty) && row.difficulty >= 1 && row.difficulty <= 3
    && Number.isInteger(row.total_marks) && row.total_marks >= 0
    && Array.isArray(row.parts)
    && Array.isArray(row.mark_scheme),
  );
}

// ── Topic selection ─────────────────────────────────────────────────────────

// Picks up to `limit` topics: thinnest first (published + pending, skipping any
// topic at the cap), subjects interleaved so a run cannot drain Physics before
// Mathematics starts, ties rotated by day for even coverage over time.
//
// One appearance per topic per run: if the eligible pool is smaller than the
// limit, fewer questions are generated — piling extras onto topics that are
// already supplied would defeat the cap's purpose.
export function rankTopics(candidates, counts, dayNumber, limit) {
  const usable = candidate => {
    const c = counts.get ? counts.get(candidate.id) : counts[candidate.id];
    return (c?.published ?? 0) + (c?.pending ?? 0);
  };

  const lists = new Map();
  for (const candidate of candidates) {
    const used = usable(candidate);
    if (used >= CAP_PER_TOPIC) continue;
    if (!lists.has(candidate.subjectId)) lists.set(candidate.subjectId, []);
    lists.get(candidate.subjectId).push({ ...candidate, usable: used });
  }

  // Deterministic subject order: the canonical subject list, not object
  // insertion order.
  const ordered = SUBJECT_IDS
    .filter(id => lists.has(id))
    .map(id => lists.get(id).sort((a, b) =>
      a.usable - b.usable
      || stableHash(`${dayNumber}:${a.id}`) - stableHash(`${dayNumber}:${b.id}`),
    ));

  const picked = [];
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const list of ordered) {
      if (picked.length >= limit) break;
      if (list[round]) { picked.push(list[round]); added = true; }
    }
    if (!added) break; // every list exhausted
  }
  return picked;
}

// ── Prompts and schemas ─────────────────────────────────────────────────────

const GENERATE_SYSTEM = [
  'You write exam questions for the Ugandan UACE syllabus.',
  '',
  'Rules:',
  '- The question must belong to exactly the topic you are given. Do not drift into neighbouring topics.',
  '- Multi-part: 3 to 5 parts labelled (a), (b), (c)… that build from fundamentals to application.',
  '- Each part is worth 1-6 marks; the whole question 6-30 marks.',
  '- mark_scheme must have at least one criterion per part. Each criterion states the',
  '  expected answer or working point precisely, INCLUDING the final numerical value',
  '  where one exists. The sum of the "max" values must equal the sum of the part marks.',
  '- The stem must be self-contained: every datum needed to answer is given in it.',
  '- Use SI units. Ugandan context (matatus, local distances, familiar prices) where natural,',
  '  never forced.',
  '- No multiple choice. No diagrams — describe anything visual in words.',
  '- difficulty: 1 = routine substitution, 2 = multi-step with a choice of method,',
  '  3 = unfamiliar context combining several ideas.',
].join('\n');

// Structured output via schema instead of "please return JSON" and fence
// stripping. propertyOrdering keeps the long parts/scheme arrays near the end
// so the model does not run out of tokens mid-object as often.
export const GENERATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    stem: { type: 'STRING' },
    difficulty: { type: 'INTEGER', description: '1, 2 or 3' },
    parts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: '(a), (b), …' },
          text: { type: 'STRING' },
          marks: { type: 'INTEGER' },
        },
        required: ['label', 'text', 'marks'],
      },
    },
    mark_scheme: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          criterion: { type: 'STRING' },
          marks: { type: 'INTEGER' },
          max: { type: 'INTEGER' },
        },
        required: ['criterion', 'marks', 'max'],
      },
    },
  },
  required: ['stem', 'difficulty', 'parts', 'mark_scheme'],
  propertyOrdering: ['stem', 'difficulty', 'parts', 'mark_scheme'],
};

export function buildGeneratePrompt({ topicName, chapterName, subjectName, difficulty }) {
  return [
    `Write one UACE ${subjectName} practice question.`,
    `Topic: "${topicName}" (chapter: "${chapterName}").`,
    `Target difficulty: ${difficulty}.`,
    'Return only the JSON object described by the schema.',
  ].join('\n');
}

// Independent numeric verification: a second, fresh call that sees only the
// finished question and must re-solve it. It catches the failure mode a
// structural check cannot — a plausible-looking mark scheme that awards 4.2 J
// when the data gives 4.8 J. Independent means separate context and fresh
// sampling at temperature 0, not a second opinion it can copy the first from.
const VERIFY_SYSTEM = [
  'You verify exam questions. You are given a finished question and its mark scheme.',
  'Work through it yourself:',
  '1. For every numerical value the mark scheme asserts as a COMPUTED result,',
  '   recompute it from the data in the stem and parts. Compare after rounding',
  '   both to 3 significant figures. Do not flag values merely given in the question.',
  '2. Check the mark scheme "max" values sum to the sum of the part marks.',
  '3. Check each criterion describes something the part actually asks for.',
  'Report each disagreement as a short sentence naming the criterion, the claimed',
  'value, and the recomputed value. ok must be true only when there are no',
  'disagreements. An empty issues array with ok=false is invalid.',
].join('\n');

export const VERIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ok: { type: 'BOOLEAN' },
    issues: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['ok', 'issues'],
  propertyOrdering: ['ok', 'issues'],
};

export function buildVerifyPrompt(row) {
  return [
    'Verify this question:',
    JSON.stringify({
      stem: row.stem,
      parts: row.parts,
      mark_scheme: row.mark_scheme,
    }, null, 2),
  ].join('\n');
}

// ── Row construction ────────────────────────────────────────────────────────

// Model output -> table row. Coercions here are deliberate: junk becomes a
// value validateRow can judge (NaN marks fail the integer check), while the
// fields the table requires stay well-formed enough that a rejected row can
// still be stored and shown in the queue.
export function buildRow(model, slot, { stamp, seq, runId }) {
  const parts = Array.isArray(model?.parts)
    ? model.parts.map(p => ({
        label: typeof p?.label === 'string' ? p.label : '',
        text: typeof p?.text === 'string' ? p.text : '',
        marks: Number(p?.marks),
      }))
    : [];

  const markScheme = Array.isArray(model?.mark_scheme)
    ? model.mark_scheme.map(c => ({
        criterion: typeof c?.criterion === 'string' ? c.criterion : '',
        marks: Number(c?.marks),
        max: Number(c?.max),
      }))
    : [];

  // Stored total uses only finite contributions so the column stays a valid
  // integer; validateRow separately recomputes from raw marks, so a NaN still
  // fails validation instead of hiding behind the fallback.
  const totalMarks = parts.reduce((sum, p) => sum + (Number.isFinite(p.marks) ? p.marks : 0), 0);

  return {
    id: buildQuestionId(stamp, slot.id, seq),
    subject: slot.subjectId,
    level: LEVEL,
    topic: slot.name,
    topic_id: slot.id,
    topics: [slot.chapterName],
    difficulty: Number(model?.difficulty),
    source: SOURCE,
    total_marks: totalMarks,
    stem: typeof model?.stem === 'string' ? model.stem : '',
    parts,
    mark_scheme: markScheme,
    status: 'pending',
    reject_reason: null,
    run_id: runId,
    generated_at: new Date().toISOString(),
  };
}

// ── Network: ai-proxy and PostgREST ─────────────────────────────────────────

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// One generate call through the proxy, with backoff on the statuses a free-tier
// Gemini key actually produces under load (429) plus transient 5xx. The proxy
// maps Gemini's 429 to { retryable: true }, which is what decides a retry here.
export async function callGenerate(env, payload, { fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_PROXY_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(15000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      await sleep(backoff);
    }
    try {
      const res = await fetchImpl(`${env.SUPABASE_URL}/functions/v1/ai-proxy`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-generator-secret': env.GENERATOR_SECRET,
        },
        body: JSON.stringify({ route: 'generate', ...payload }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.text ?? '';
      }

      let detail = {};
      try { detail = await res.json(); } catch { /* non-JSON body */ }
      lastError = new Error(detail.error || `ai-proxy returned ${res.status}`);
      const retryable = res.status === 429 || res.status >= 500 || detail.retryable === true;
      if (!retryable) throw lastError;
    } catch (err) {
      // A thrown non-retryable error leaves immediately; network failures
      // (fetch's own TypeError) are worth another attempt.
      if (err === lastError && !/fetch|network/i.test(err.message)) throw err;
      lastError = err;
    }
  }
  throw lastError ?? new Error('generate call failed');
}

function serviceHeaders(env) {
  return {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Existing rows, folded into the three things the run needs: per-topic live
// counts (the cap), the id set (skip-what-exists), and per-topic sequence
// numbers (continue gen-…-01, gen-…-02 instead of colliding).
export async function fetchExisting(env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/practice_questions?select=id,topic_id,status&limit=10000`,
    { headers: serviceHeaders(env) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`could not read practice_questions (${res.status}): ${body.slice(0, 200)}`);
  }
  const rows = await res.json();

  const counts = new Map();
  const ids = new Set();
  const prefixCounts = new Map();

  for (const row of rows) {
    ids.add(row.id);
    if (row.status === 'pending' || row.status === 'published') {
      const c = counts.get(row.topic_id) ?? { pending: 0, published: 0 };
      c[row.status] += 1;
      counts.set(row.topic_id, c);
    }
    // gen-<YYYYMMDD>-<topicId>-<nn> — topic ids contain dashes themselves, so
    // anchor the sequence digits at the end.
    const m = /^gen-(\d{8})-(.+)-(\d+)$/.exec(row.id);
    if (m) {
      const key = `${m[1]}-${m[2]}`;
      prefixCounts.set(key, Math.max(prefixCounts.get(key) ?? 0, Number(m[3])));
    }
  }
  return { counts, ids, prefixCounts, rows };
}

// Batch insert. on_conflict=id + merge-duplicates keeps a retry after a partial
// failure idempotent even though fetchExisting already filtered the known ids.
export async function insertRows(env, rows) {
  if (rows.length === 0) return 0;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/practice_questions?on_conflict=id`,
    {
      method: 'POST',
      headers: { ...serviceHeaders(env), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`could not insert ${rows.length} rows (${res.status}): ${body.slice(0, 300)}`);
  }
  const inserted = await res.json();
  return Array.isArray(inserted) ? inserted.length : rows.length;
}

// ── The run ─────────────────────────────────────────────────────────────────

function readArgs(argv) {
  const limitArg = argv.find(a => a.startsWith('--limit='));
  const limit = limitArg
    ? Number(limitArg.split('=')[1])
    : argv.includes('--limit')
      ? Number(argv[argv.indexOf('--limit') + 1])
      : Number(process.env.GENERATE_LIMIT) || DEFAULT_LIMIT;
  return {
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : DEFAULT_LIMIT,
    dryRun: argv.includes('--dry-run'),
  };
}

async function generateOnce(env, prompt, opts = {}) {
  const text = await callGenerate(env, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: GENERATE_SYSTEM }] },
    generationConfig: {
      temperature: opts.temperature ?? 0.85,
      maxOutputTokens: opts.maxOutputTokens ?? 3072,
      responseMimeType: 'application/json',
    },
    responseSchema: GENERATE_SCHEMA,
  });
  return parseModelJson(text);
}

// Returns { status: 'ok' | 'unverifiable' | 'failed', issues }.
// 'unverifiable' (verifier itself broke or returned nonsense) must NOT reject
// content — an infrastructure failure is not evidence against the question, and
// losing a whole day's batch over a transient error is worse than letting the
// admin review it as usual.
async function verifyQuestion(env, row) {
  let text;
  try {
    text = await callGenerate(env, {
      contents: [{ role: 'user', parts: [{ text: buildVerifyPrompt(row) }] }],
      systemInstruction: { parts: [{ text: VERIFY_SYSTEM }] },
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1536,
        responseMimeType: 'application/json',
      },
      responseSchema: VERIFY_SCHEMA,
    });
  } catch (err) {
    console.warn(`  verification unavailable for ${row.id}: ${err.message}`);
    return { status: 'unverifiable' };
  }

  const verdict = parseModelJson(text);
  if (!verdict || typeof verdict.ok !== 'boolean') {
    console.warn(`  verification returned unusable output for ${row.id}`);
    return { status: 'unverifiable' };
  }
  if (verdict.ok === true) return { status: 'ok' };
  const issues = Array.isArray(verdict.issues) ? verdict.issues.map(String) : [];
  return { status: 'failed', issues: issues.length ? issues : ['verifier reported a problem without detail'] };
}

export async function run(argv = process.argv.slice(2), envIn = process.env) {
  const { limit, dryRun } = readArgs(argv);
  const env = readEnv(envIn);
  const stamp = dayStamp();
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const runId = envIn.GITHUB_RUN_ID ? `gh-${envIn.GITHUB_RUN_ID}` : `local-${stamp}-${Date.now().toString(36)}`;

  console.log(`generate-questions: limit=${limit} dryRun=${dryRun} run=${runId}`);

  const { counts, ids, prefixCounts } = await fetchExisting(env);

  // Idempotent re-runs: a topic already covered today is skipped, and once the
  // day's limit is met the run stops. Without this, a retried job would quietly
  // add a second day's worth of questions under sequence 02, 03, … and the
  // "50 per day" ceiling would only hold for successful runs.
  const coveredToday = [...ids].filter(id => id.startsWith(`gen-${stamp}-`)).length;
  if (coveredToday >= limit) {
    console.log(`already at today's limit (${coveredToday}/${limit}); nothing to do`);
    return { pending: 0, rejectedValidation: 0, rejectedNumeric: 0, failed: 0, unverifiable: 0, skippedExisting: 0, uninsertable: 0 };
  }

  const candidates = SUBJECT_IDS.flatMap(subjectId =>
    listTopics(subjectId).map(topic => ({
      subjectId,
      id: topic.id,
      name: topic.name,
      chapterId: topic.chapterId,
      chapterName: topic.chapterName,
    })),
  );
  const atCap = candidates.filter(c => {
    const v = counts.get(c.id);
    return ((v?.published ?? 0) + (v?.pending ?? 0)) >= CAP_PER_TOPIC;
  }).length;

  const slots = rankTopics(candidates, counts, dayNumber, limit - coveredToday);
  console.log(`${candidates.length} topics eligible (${atCap} at cap of ${CAP_PER_TOPIC}); generating ${slots.length}`);

  const results = { pending: 0, rejectedValidation: 0, rejectedNumeric: 0, failed: 0, unverifiable: 0, skippedExisting: 0, uninsertable: 0 };
  const toInsert = [];

  for (const [index, slot] of slots.entries()) {
    // Already written by an earlier run today — leave it alone, including rows
    // an admin has already reviewed.
    if (prefixCounts.has(`${stamp}-${slot.id}`)) {
      results.skippedExisting++;
      continue;
    }
    const seq = nextSequence(prefixCounts, stamp, slot.id);
    const difficulty = 1 + (index % 3); // spread difficulties within a run

    const prompt = buildGeneratePrompt({
      topicName: slot.name,
      chapterName: slot.chapterName,
      subjectName: slot.subjectId === 'physics' ? 'Physics' : 'Mathematics',
      difficulty,
    });

    let model = null;
    try {
      model = await generateOnce(env, prompt);
    } catch (err) {
      console.warn(`  generate failed for ${slot.name}: ${err.message}`);
    }

    let row = model ? buildRow(model, slot, { stamp, seq, runId }) : null;
    let verdict = row ? validateRow(row) : { ok: false, reason: 'model returned no parseable JSON' };

    for (let attempt = 0; !verdict.ok && attempt < STRUCTURAL_RETRIES; attempt++) {
      try {
        const retryModel = await generateOnce(env, prompt, { temperature: 1.0 });
        const retryRow = buildRow(retryModel, slot, { stamp, seq, runId });
        const retryVerdict = validateRow(retryRow);
        if (retryVerdict.ok || canInsert(retryRow)) {
          row = retryRow;
          verdict = retryVerdict;
          break;
        }
      } catch (err) {
        console.warn(`  retry failed for ${slot.name}: ${err.message}`);
        break;
      }
    }

    if (!row) {
      results.failed++;
      continue;
    }

    if (!verdict.ok) {
      // Recorded as rejected so the queue shows what went wrong instead of the
      // question vanishing without trace.
      row.status = 'rejected';
      row.reject_reason = `Validation failed: ${verdict.reason}`;
      results.rejectedValidation++;
      if (canInsert(row)) toInsert.push(row); else results.uninsertable++;
      console.warn(`  rejected ${row.id}: ${verdict.reason}`);
      await sleep(SLEEP_BETWEEN_CALLS_MS);
      continue;
    }

    const verify = await verifyQuestion(env, row);
    if (verify.status === 'failed') {
      row.status = 'rejected';
      row.reject_reason = `Numeric verification failed: ${verify.issues.join('; ')}`;
      results.rejectedNumeric++;
      console.warn(`  rejected ${row.id}: ${row.reject_reason}`);
    } else {
      if (verify.status === 'unverifiable') results.unverifiable++;
      row.status = 'pending';
      results.pending++;
    }
    toInsert.push(row);
    await sleep(SLEEP_BETWEEN_CALLS_MS);
  }

  if (dryRun) {
    console.log(`dry run: ${toInsert.length} rows would be inserted, none were`);
  } else {
    const inserted = await insertRows(env, toInsert);
    console.log(`inserted ${inserted} rows`);
  }

  console.log(
    `done: ${results.pending} pending, ` +
    `${results.rejectedValidation} rejected (validation), ` +
    `${results.rejectedNumeric} rejected (numeric), ` +
    `${results.failed} failed to generate, ` +
    `${results.skippedExisting} already existed` +
    (results.unverifiable ? `, ${results.unverifiable} unverified` : '') +
    (results.uninsertable ? `, ${results.uninsertable} uninsertable` : ''),
  );
  return results;
}

// Only execute when invoked directly (node scripts/generate-questions.mjs), not
// when the tests import the pure functions above.
const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  run().catch(err => {
    console.error(`generate-questions failed: ${err.message}`);
    process.exitCode = 1;
  });
}
