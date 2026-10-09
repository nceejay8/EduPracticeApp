// AI-generated practice scenarios, loaded from Supabase at runtime.
//
// These are deliberately NOT in this file the way the other 19 scenarios are.
// The built-ins are hand-authored and ship in the bundle; generated ones arrive
// daily from .github/workflows/generate-questions.yml, and a bundled array cannot
// grow without a rebuild. So they live in a table and are fetched once per
// session.
//
// The read is a cache, not a store. Everything downstream of here — the coverage
// map, the workboard picker — is synchronous and already assumes an array is
// available, so this module keeps the async part to one call and exposes a plain
// array afterwards. getPublishedScenarios() returns [] until loadPublishedScenarios()
// resolves, which is the same contract getCustomScenarios() has on a fresh
// device.
//
// This module deliberately imports nothing but supabaseClient. The coverage map
// (syllabusProgress.js) needs to read the pool, and the practice pickers need to
// read the coverage map, so importing the invalidator from here would close a
// cycle: practiceScenarios -> publishedScenarios -> syllabusProgress ->
// practiceScenarios. Instead the hook that coordinates the load is the one place
// that knows about both, and it calls invalidateCoverage() once the pool lands.

import { supabase } from '../lib/supabaseClient';

// Module-level rather than in a hook, because three separate call sites need the
// same array and a context would mean threading it through all of them.
let cache = [];
let loaded = false;
let inFlight = null;

// Components that render content derived from the pool need to re-render when it
// lands. A context would mean threading a provider through every consumer; a
// listener set keeps the module as the single source of truth and lets
// usePublishedScenarios be a thin subscription.
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(cache, loaded); } catch { /* one bad listener must not stop the rest */ }
  }
}

// The table is snake_case; a scenario is camelCase. Mapping here rather than in
// the callers keeps that in one place, and it is also the last chance to refuse a
// malformed row before it reaches the workboard.
//
// Anything that cannot be made into a usable scenario is dropped. A question that
// renders as a blank stem or crashes the mark-up is worse than a missing one, and
// the generator has already validated what it writes, so a bad row here means
// something upstream regressed and should be visible as "some questions missing"
// rather than as a broken page.
function toScenario(row) {
  const parts = Array.isArray(row.parts) ? row.parts : [];
  const markScheme = Array.isArray(row.mark_scheme) ? row.mark_scheme : [];

  if (!row.id || !row.stem?.trim()) return null;

  // `written` is the legacy shape (parts + mark scheme). Objective rows are the
  // newer multiple-choice / numeric kinds, graded locally in practice, so they
  // carry a single answer instead of a mark scheme.
  const type = row.type === 'mcq' || row.type === 'numeric' ? row.type : 'written';

  const base = {
    id: row.id,
    subject: row.subject,
    level: row.level,
    // `topic` is what the attribution rule resolves; `topics` are the extra tags
    // that let a specific tag win over a broad one.
    topic: row.topic,
    topics: Array.isArray(row.topics) ? row.topics : [],
    difficulty: Number(row.difficulty),
    source: row.source || 'AI-generated practice scenario',
    stem: row.stem,
    type,
    generated: true,
  };

  if (type === 'mcq') {
    const options = Array.isArray(row.options) ? row.options : [];
    if (options.length < 2 || row.answer === undefined || row.answer === null) return null;
    return {
      ...base,
      totalMarks: Number(row.total_marks) || Number(row.marks) || 1,
      options,
      answer: row.answer,
    };
  }

  if (type === 'numeric') {
    if (row.answer === undefined || row.answer === null) return null;
    return {
      ...base,
      totalMarks: Number(row.total_marks) || Number(row.marks) || 1,
      answer: Number(row.answer),
      tolerance: Number(row.tolerance) || 0.01,
    };
  }

  const cleanParts = parts
    .filter(p => p?.text?.trim() && Number(p.marks) > 0)
    .map(p => ({ label: p.label ?? '', text: p.text, marks: Number(p.marks) }));
  if (cleanParts.length === 0) return null;

  const cleanScheme = markScheme
    .filter(c => c?.criterion?.trim())
    .map(c => ({ criterion: c.criterion, marks: Number(c.marks) || 0, max: Number(c.max) || 0 }));

  return {
    ...base,
    // Recomputed rather than read from the row, so a stored total that drifted
    // from its parts cannot misreport a paper's length.
    totalMarks: cleanParts.reduce((sum, p) => sum + p.marks, 0),
    parts: cleanParts,
    markScheme: cleanScheme,
  };
}

// The currently loaded published scenarios. Empty until hydrated — every caller
// already handles an empty pool, so an offline student is unaffected.
export function getPublishedScenarios() {
  return cache;
}

export function isPublishedLoaded() {
  return loaded;
}

// Idempotent: concurrent callers share one request, because the app mounts
// several components that each want the pool.
export function loadPublishedScenarios() {
  if (inFlight) return inFlight;

// No Supabase configured is a normal state during local development, and is
// handled the same way as a failure — the app works with built-in content.
  if (!supabase) {
    loaded = true;
    notify();
    return Promise.resolve(cache);
  }

  inFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from('practice_questions')
        .select('id, subject, level, topic, topic_id, topics, difficulty, source, total_marks, stem, parts, mark_scheme')
        .eq('status', 'published');

      if (error) throw error;

      const seen = new Set();
      cache = (data ?? [])
        .map(toScenario)
        .filter(Boolean)
        .filter(s => {
          // Defensive: a duplicate id would make the daily picker's modulo seed
          // land on a coin flip, and the generator is supposed to make these
          // unique.
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

      loaded = true;
      notify();
    } catch (err) {
      // A failed fetch leaves the pool empty and the built-ins still working.
      // This must not throw: it runs during boot, and a rejected promise there
      // would take the whole app down over a content refresh.
      console.warn('[publishedScenarios] could not load generated questions:', err.message);
      loaded = true;
      notify();
    } finally {
      inFlight = null;
    }
    return cache;
  })();

  return inFlight;
}

// Subscribes to the pool. The callback fires immediately with whatever is cached
// and again whenever it changes, so a component that mounts late does not have to
// wait for the next load.
export function subscribeToPublishedScenarios(fn) {
  listeners.add(fn);
  fn(cache, loaded);
  return () => listeners.delete(fn);
}

// Test seam. The coverage assertions need to exercise a pool without a network.
export function __setPublishedScenariosForTest(scenarios) {
  cache = scenarios;
  loaded = true;
  notify();
}
