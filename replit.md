# EduPractice — build notes

## The syllabus

`/syllabus` is the canonical outline for the app. One tree, defined once in
`src/data/syllabus.js`, and everything else derives from it:

| Subject | Chapters | Topics | Subtopics |
| --- | --- | --- | --- |
| Physics | 6 | 39 | 112 |
| Mathematics | 8 | 41 | 107 |

Levels (`A-Level`, `UACE`) currently share one tree. A-Level and UACE questions
are interchangeable (`LEVEL_EQUIVALENTS` in `examBank.js`), so the outline is
keyed by level for future divergence but does not fork today.

### The content-attribution rule

Everything hangs off one function: `resolveContentRef(subject, topic, tags)` in
`syllabus.js`. It decides which topic a question, scenario or past attempt
belongs to.

- A **specific** match (subtopic/topic) always beats a broad one (chapter). A
  scenario tagged `['Modern Physics', 'Quantum Mechanics']` credits Quantum
  Mechanics; it is not served for the sibling topics in Modern Physics.
- A chapter-wide scenario is credited to every topic in that chapter, because it
  is genuinely servable for any of them.
- A chapter-wide *exam* question is **not** credited to every topic. That would
  offer a "topic exam" per topic built from the same handful of questions and
  report a question count the paper cannot deliver.
- A tag that cannot be placed returns `null` and is reported as unattributed. It
  is not filed under the subject, which would inflate subject accuracy with work
  we cannot actually place.
- A subject hint always wins, so `Statics` resolves to
  `phy-mech-equilibrium` under Physics and `mat-mech-statics` under Mathematics.

The rule lives in `syllabus.js` rather than `syllabusProgress.js` because the
practice scenario picker needs it too, and the progress engine already imports
the scenario bank — putting it there would be an import cycle.

## Coverage is honest

`src/data/syllabusProgress.js` measures what material exists behind each topic,
split into three pools because three different code paths serve them:

| Pool | Source | Serves |
| --- | --- | --- |
| `exam` | `questionBank` | the MCQ/numeric slots in a paper |
| `scenario` | `scenarioBank` | Uganda-context questions, only reachable via reserved scenario slots |
| `practice` | `PRACTICE_SCENARIOS` + admin scenarios | the AI workboard |

`examTotal = exam + scenario` is what a topic exam can draw on, and `total` adds
practice. The annotated topic carries `practiceAvailable` and `examAvailable` so
the outline can answer "is there something to practise?" and "is there a paper to
sit?" separately — a topic can honestly be yes to one and no to the other.

A topic with no material stays visible and reads "Coming soon", with its actions
disabled. Showing the whole syllabus matters: a student can see what they have
not covered yet, not just what happens to be built.

`buildTopicExams` (`src/data/topicExams.js`) reads these same numbers rather
than re-matching the banks, so the syllabus page and the Mock Exams page cannot
disagree about which topics have a paper. `test/syllabus.test.mjs` asserts that
agreement, including that every offered paper assembles to the length it
advertises.

## Progress

Exam attempts come from Supabase *and* the local cache, via
`useAnalyticsData` → `data.attempts`. AI practice attempts are localStorage only
(`getPracticeAttempts()` in `utils/analyticsTracker.js`).

Both are folded into the same outline. An exam breakdown item contributes its
marks; a practice attempt counts as one mark worth its score, so a single AI
question is comparable to one exam question regardless of paper weighting.

| Accuracy | Status |
| --- | --- |
| ≥ 80% | `mastered` |
| ≥ 50% | `developing` |
| < 50% | `learning` |
| no attempts | `not-started` |

Accuracy is `0` for an untouched syllabus, so the UI guards on `stats.total`
rather than on the accuracy value. Rendering a confident "0%" for work nobody has
done would be a lie.

Coverage is memoised per subject; call `invalidateCoverage()` after adding or
editing scenarios in `/admin`.

## Deep links

Every syllabus view is a URL: `?level=&subject=&topic=`.

Level ids are parsed by `normalizeLevelId`, which accepts both the id (`uace`)
and the raw label (`UACE`). Links into `/syllabus` come from several pages
written at different times, and some carry the label — parsing only one form
meant clicking back from a UACE topic exam landed on the A-Level outline for no
visible reason. Use `levelToLevelId` when building query strings.

`/mock-exams?level=&subject=&topic=` opens with that paper ready to confirm.

## Sessions last a week

A signed-in session lasts 7 days from sign-in, then the student is signed out and
asked to sign in again. Absolute window, not an idle timeout: activity does not
extend it. Policy lives in `client-ui/src/lib/sessionPolicy.js`, wired up in
`AuthContext`, with a sign-out button and a "days left" chip in both sidebars.

Points worth knowing before changing it:

- **The start instant is in `localStorage`**, not Supabase. sessionStorage would
  end the session whenever the tab closed, which is the opposite of the feature.
- **It is a cap, not the source of truth.** Supabase's session and refresh-token
  settings live in the dashboard, not in this repo. Client code can only shorten
  a session, never lengthen it — if the dashboard expires sessions sooner, so do
  we, and no code change here can prevent that.
- **Pre-existing sessions are adopted**, not killed. A session with no marker gets
  a full window on first load, so nobody is logged out by a policy that did not
  exist when their session started.
- **An expired session is ended before any protected route renders**, so it is
  never briefly usable.
- **Timers are not trusted alone.** Background tabs and sleeping laptops throttle
  `setTimeout`, so the deadline is re-checked on `focus` and `visibilitychange`.
- **Why the session ended is recorded**, and the login page reads it once. Without
  that, a student returning after a week is dropped on a bare login form and has
  no idea whether they were hacked, bugged, or simply expected to sign in again.

`test/session.test.mjs` covers the edges: the exact boundary, reload survival, a
backwards clock, blocked storage, non-numeric markers, and the read-once
sign-out reason. If you change this policy, run it.

## Offline and syncing

Everything a student does is written to `localStorage` first and synchronously.
Nothing important waits on a network request, so practice, exams and the syllabus
all work with no connection at all. The network is only used to *copy* work to
other devices.

Two mechanisms, and the distinction matters:

- **The outbox** (`lib/syncQueue.js`) is the record of writes that still owe the
  server a copy. A write is enqueued, not pushed inline. An inline push that
  fails while offline is a write that never happens and is never retried — which
  is exactly how attempts used to go missing. `useSyncEngine` drains the queue on
  mount, on `online`, on `focus`, and once a minute as a backstop.
- **The merge** (`lib/attemptMerge.js`) is what keeps the UI honest *while* a sync
  is still pending. The read path used to replace the local list with the server
  list, so an attempt completed offline stayed on disk but vanished from every
  analytics view the moment the network returned. Local and server lists are now
  unioned and de-duplicated by attempt id.

Attempt ids are generated at record time and are the idempotency key for both.
That is what makes a retry safe: the same attempt can be queued, retried and
merged any number of times without ever producing a second row. Attempts recorded
before ids existed derive one from their own contents, so they cannot be
double-counted after their first sync.

On a conflict the server row wins, but the two are *merged* rather than swapped,
so local-only fields survive — a practice attempt's `subject`/`topicId` exist
only locally, and dropping them would move it out of per-topic progress.

### Session behaviour offline

A token refresh that cannot reach the server ends the session locally even though
it is still valid. Signing the student out there throws away a working session
because they were on a train, so `AuthContext` holds the session open and sets
`isOffline` instead. That is a deferral, not a bypass: on reconnect the app asks
the server whether the session is genuinely still good, and signs the student out
then if it is not.

`OfflineBanner` states the two things that matter — the work is safe, and only
some features are unavailable. It is deliberately not a blocking modal:
interrupting a student mid-question to say something that does not affect the task
in front of them is worse than saying nothing. Maestro chat is the one feature
that genuinely needs a network, and it says so rather than hanging.

### What still does not work offline

There is **no service worker**, so a cold load with no network fails — only an
already-open tab survives. That is the remaining gap, and it needs a build-step
change (a hand-written service worker risks serving stale assets).

### Database

`supabase/migrations/20260926_practice_attempts.sql` must be run once for
cross-device practice progress. Until then practice attempts still work on the
device that made them, and the queue retries in the background. The migration
enables RLS and adds append-only policies — without them the table is readable by
anyone, so do not skip that part.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # eslint (configured for .ts/.tsx; .jsx is not covered)
npm test        # syllabus + session policy + offline sync
```

The test runs on plain Node — `test/register.mjs` bridges the two gaps between
Vite and Node (extensionless imports, `import.meta.env`). No test framework.
`test/sync.test.mjs` covers the merge rules and the outbox: an offline attempt
staying visible, syncing exactly once, a failing row not blocking the rows behind
it, and a corrupt queue being filtered rather than flushed.
