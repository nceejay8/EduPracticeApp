import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useLocalization } from '../contexts/LocalizationContext';
import useAnalyticsData from '../hooks/useAnalyticsData';
import {
  SYLLABUS,
  SUBJECT_IDS,
  SYLLABUS_LEVELS,
  getSubject,
  getTopic,
  listChapters,
  normalizeSubject,
  normalizeLevelId,
  levelToLevelId,
  countTopics,
  countSubtopics,
} from '../data/syllabus';
import {
  computeSyllabusProgress,
  getTopicCoverage,
  getSubjectCoverage,
  nextTopicToStudy,
  topicsNeedingAttention,
  findTopicProgress,
  STATUS_META,
} from '../data/syllabusProgress';
import usePracticeAttempts from '../hooks/usePracticeAttempts';
import { Badge, EmptyState, ProgressBar, subjectIcon } from '../components/ui';

const LEVEL_IDS = { 'a-level': 'A-Level', uace: 'UACE' };

const levelIdToLabel = normalizeLevelId;
const labelToLevelId = levelToLevelId;
const levelBadgeLabel = (label) => (label === 'UACE' ? 'UACE' : 'A-Level');
export default function Syllabus() {
  const { t } = useLocalization();
  const { data: analytics } = useAnalyticsData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Exam attempts come from Supabase *and* the local cache via useAnalyticsData.
  // Practice attempts are merged the same way, so per-topic progress reflects
  // work done on any of the student's devices rather than only this one.
  const attempts = useMemo(() => analytics?.attempts || [], [analytics]);
  const { attempts: practiceAttempts } = usePracticeAttempts();
  const progress = useMemo(
    () => computeSyllabusProgress({ attempts, practiceAttempts }),
    [attempts, practiceAttempts]
  );

  // ── State, seeded from the URL so every view is shareable ────────────────
  // /syllabus?level=uace&subject=mathematics&topic=mat-algebra-surds
  const [level, setLevel] = useState(
    () => levelIdToLabel(searchParams.get('level')) || 'A-Level'
  );
  const [subjectId, setSubjectId] = useState(
    () => normalizeSubject(searchParams.get('subject')) || 'physics'
  );
  const [topicId, setTopicId] = useState(() => {
    const wanted = searchParams.get('topic');
    return wanted && getTopic(normalizeSubject(searchParams.get('subject')) || 'physics', wanted)
      ? wanted
      : null;
  });
  const [openChapters, setOpenChapters] = useState(() => new Set());
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const [query, setQuery] = useState('');

  // Keep state in sync when the URL changes (search modal, topic exam cards,
  // browser back). Only rewrite state — never the URL — from this effect.
  useEffect(() => {
    const nextLevel = levelIdToLabel(searchParams.get('level'));
    if (nextLevel) setLevel(nextLevel);
    const nextSubject = normalizeSubject(searchParams.get('subject'));
    if (nextSubject && SYLLABUS[nextSubject]) {
      setSubjectId(nextSubject);
      const wanted = searchParams.get('topic');
      setTopicId(wanted && getTopic(nextSubject, wanted) ? wanted : null);
    }
  }, [searchParams]);

  const pushUrl = (next) => {
    const clean = {};
    Object.entries(next).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') clean[key] = String(value);
    });
    setSearchParams(clean, { replace: true });
  };

  const selectLevel = (label) => {
    setLevel(label);
    pushUrl({ level: labelToLevelId(label), subject: subjectId, topic: topicId });
  };

  const selectSubject = (id) => {
    setSubjectId(id);
    setTopicId(null);
    setOpenChapters(new Set());
    setOpenTopics(new Set());
    pushUrl({ level: labelToLevelId(level), subject: id, topic: null });
  };

  const selectTopic = (id) => {
    setTopicId(id);
    pushUrl({ level: labelToLevelId(level), subject: subjectId, topic: id });
  };

  // Jumping to a search result in another subject cannot reuse selectSubject +
  // selectTopic: the second call closes over the *old* subjectId and would
  // overwrite the subject that the first call had just written, leaving a
  // topic that belongs to a subject the URL no longer names.
  const goToMatch = (m) => {
    setSubjectId(m.subjectId);
    setTopicId(m.topic.id);
    setOpenChapters(new Set([m.topic.chapterId]));
    setOpenTopics(new Set([m.topic.id]));
    pushUrl({
      level: labelToLevelId(level),
      subject: m.subjectId,
      topic: m.topic.id,
    });
  };

  const toggleIn = (setter) => (id) =>
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleChapter = toggleIn(setOpenChapters);
  const toggleTopic = toggleIn(setOpenTopics);

  // ── Derived outline data ─────────────────────────────────────────────────
  const subject = getSubject(subjectId);
  const chapters = useMemo(() => listChapters(subjectId), [subjectId]);
  const subjectProgress = progress.subjects?.[subjectId];
  const recommended = useMemo(() => nextTopicToStudy(progress, subjectId), [progress, subjectId]);
  const weakTopics = useMemo(
    () => topicsNeedingAttention(progress, subjectId).slice(0, 4),
    [progress, subjectId]
  );

  const active = topicId ? getTopic(subjectId, topicId) : null;
  const activeProgress = topicId
    ? findTopicProgress(progress, subjectId, topicId)?.topic
    : null;
  const activeCoverage = topicId ? getTopicCoverage(subjectId, topicId) : null;

  // ── Outline-wide search ──────────────────────────────────────────────────
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    SUBJECT_IDS.forEach(sid => {
      listChapters(sid).forEach(chapter => {
        chapter.topics.forEach(topic => {
          const haystack = [
            topic.name,
            ...(topic.aliases || []),
            ...topic.subtopics.flatMap(s => [s.name, ...(s.aliases || [])]),
          ].join(' ').toLowerCase();
          if (haystack.includes(q)) out.push({ subjectId: sid, chapterName: chapter.name, topic });
        });
      });
    });
    return out.slice(0, 10);
  }, [query]);

  const startedPct = subjectProgress?.topicsTotal
    ? Math.round((subjectProgress.topicsStarted / subjectProgress.topicsTotal) * 100)
    : 0;

  return (
    <div className="w-full bg-[#0B1120]">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#f99c00]/20 to-[#f99c00]/5 px-4 sm:px-6 md:px-8 py-8 sm:py-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f99c00]/15 border border-[#f99c00]/30 text-[#f99c00] text-xs font-semibold mb-3">
            <Icon icon="solar:layers-linear" width="14" />
            {t('nav.syllabus')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            {t('syllabus.title')}
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-3xl">
            {t('syllabus.subtitle')}
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-8 sm:py-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Search + level ────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-linear"
                width="18"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('syllabus.searchPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#f99c00]/50 transition-colors"
              />
              {query.trim().length >= 2 && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-[#111827] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  {matches.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">{t('syllabus.noResults')}</p>
                  ) : (
                    matches.map(m => (
                      <button
                        key={`${m.subjectId}-${m.topic.id}`}
                        onClick={() => {
                          setQuery('');
                          goToMatch(m);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3"
                      >
                        <Icon
                          icon={subjectIcon(getSubject(m.subjectId).name)}
                          width="18"
                          className="text-slate-400 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white truncate">
                            {m.topic.name}
                          </span>
                          <span className="block text-xs text-slate-400 truncate">
                            {getSubject(m.subjectId).name} · {m.chapterName}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {SYLLABUS_LEVELS.map(l => (
                <button
                  key={l}
                  onClick={() => selectLevel(l)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    level === l
                      ? 'bg-[#f99c00] text-[#0B1120]'
                      : 'bg-white/5 border border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* ── Subject summary cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {SUBJECT_IDS.map(sid => {
              const s = getSubject(sid);
              const p = progress.subjects?.[sid];
              const cov = getSubjectCoverage(sid);
              const pct = p?.topicsTotal
                ? Math.round((p.topicsStarted / p.topicsTotal) * 100)
                : 0;
              const active_ = sid === subjectId;

              return (
                <button
                  key={sid}
                  onClick={() => selectSubject(sid)}
                  className={`text-left rounded-2xl p-5 border transition-all ${
                    active_
                      ? 'bg-[#f99c00]/10 border-[#f99c00]/40'
                      : 'bg-white/5 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                      <Icon icon={subjectIcon(s.name)} width="22" className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-white truncate">{s.name}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.chapters.length} chapters · {countTopics(sid)} topics · {countSubtopics(sid)} subtopics
                      </p>
                    </div>
                    <Badge tone={STATUS_META[p?.stats?.status || 'not-started'].tone}>
                      {p?.stats?.total > 0 ? `${p.stats.accuracy}%` : t('syllabus.notStarted')}
                    </Badge>
                  </div>

                  <ProgressBar pct={pct} />
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                    <span>{p?.topicsStarted || 0} / {p?.topicsTotal || 0} topics started</span>
                    <span>{cov.topicsWithContent} with material</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Guidance panels ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {recommended && (
              <div className="rounded-2xl border border-[#f99c00]/30 bg-[#f99c00]/5 p-5">
                <p className="text-xs uppercase tracking-wider text-[#f99c00] font-semibold mb-1">
                  {t('syllabus.nextUp')}
                </p>
                <p className="text-base font-bold text-white">{recommended.topicName}</p>
                <p className="text-sm text-slate-300 mt-1">{recommended.chapterName}</p>
                <Link
                  to={`/practice?level=${labelToLevelId(level)}&subject=${recommended.subjectId}&topic=${recommended.topicId}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#f99c00] hover:underline"
                >
                  {t('syllabus.startTopic')} <Icon icon="solar:arrow-right-linear" width="16" />
                </Link>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
                {t('syllabus.needsAttention')}
              </p>
              {weakTopics.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {subjectProgress?.topicsStarted
                    ? t('syllabus.allOnTrack')
                    : t('syllabus.startToSeeProgress')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {weakTopics.map(item => (
                    <li key={item.topicId}>
                      <button
                        onClick={() => selectTopic(item.topicId)}
                        className="w-full text-left flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-white truncate">
                            {item.topicName}
                          </span>
                          <span className="block text-xs text-slate-500 truncate">
                            {item.chapterName}
                          </span>
                        </span>
                        <Badge tone={STATUS_META[item.stats.status].tone}>
                          {item.stats.accuracy}%
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Selected topic detail ─────────────────────────────────────── */}
          {active && activeProgress && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                    {subject.name} · {active.chapter.name}
                  </p>
                  <h2 className="text-xl font-bold text-white">{active.topic.name}</h2>
                  <p className="text-sm text-slate-400 mt-1">{subject.description}</p>
                </div>
                <button
                  onClick={() => selectTopic(null)}
                  className="text-slate-400 hover:text-white transition-colors shrink-0"
                  aria-label={t('common.close')}
                >
                  <Icon icon="solar:close-circle-linear" width="22" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <Stat label={t('syllabus.accuracy')} value={`${activeProgress.stats.accuracy}%`} />
                <Stat label={t('syllabus.attempts')} value={activeProgress.stats.attempts} />
                <Stat
                  label={t('syllabus.status')}
                  value={STATUS_META[activeProgress.stats.status].label}
                />
                <Stat
                  label={t('syllabus.material')}
                  value={activeCoverage?.total || 0}
                />
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  {t('syllabus.subtopics')}
                </p>
                <div className="space-y-1.5">
                  {active.topic.subtopics.map(sub => {
                    const subProgress = activeProgress.subtopics.find(s => s.id === sub.id);
                    const stats = subProgress?.stats;
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 rounded-lg bg-black/20 border border-white/5 px-3 py-2"
                      >
                        <Icon
                          icon="solar:alt-arrow-right-linear"
                          width="14"
                          className="text-slate-600 shrink-0"
                        />
                        <span className="flex-1 min-w-0 text-sm text-slate-200 truncate">
                          {sub.name}
                        </span>
                        <div className="hidden sm:block w-24">
                          <ProgressBar pct={stats?.accuracy || 0} />
                        </div>
                        <Badge tone={STATUS_META[stats?.status || 'not-started'].tone} className="shrink-0">
                          {stats?.total ? `${stats.accuracy}%` : '—'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <TopicLink
                  to={`/practice?level=${labelToLevelId(level)}&subject=${subjectId}&topic=${active.topic.id}`}
                  disabled={activeCoverage?.practice === 0}
                  icon="solar:pen-new-square-linear"
                  label={t('syllabus.aiPractice')}
                  hint={activeCoverage?.practice}
                />
                <TopicLink
                  to={`/mock-exams?level=${labelToLevelId(level)}&subject=${subjectId}&topic=${active.topic.id}`}
                  disabled={activeCoverage?.examTotal === 0}
                  icon="solar:document-text-linear"
                  label={t('syllabus.topicExam')}
                  hint={activeCoverage?.examTotal}
                />
              </div>
            </section>
          )}

          {/* ── Chapter accordion ─────────────────────────────────────────── */}
          <div className="space-y-4">
            {chapters.length === 0 ? (
              <EmptyState
                title={t('syllabus.noResults')}
                hint={t('syllabus.contentSoon')}
                icon="solar:layers-linear"
              />
            ) : chapters.map((chapter, index) => {
              const chapterProgress = subjectProgress?.chapters.find(c => c.id === chapter.id);
              const isOpen = openChapters.has(chapter.id) || active?.chapter.id === chapter.id;

              return (
                <section
                  key={chapter.id}
                  className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                >
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full text-left p-5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl bg-[#f99c00]/15 text-[#f99c00] flex items-center justify-center font-bold text-sm shrink-0">
                      {index + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm sm:text-base font-bold text-white truncate">
                        {chapter.name}
                      </span>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {chapter.topics.length} topics · {chapterProgress?.topicsStarted || 0} started
                        {chapterProgress?.topicsWithContent
                          ? ` · ${chapterProgress.topicsWithContent} with material`
                          : ''}
                      </span>
                    </span>
                    <span className="hidden sm:flex items-center gap-3 w-40 shrink-0">
                      <ProgressBar pct={chapterProgress?.stats.accuracy || 0} />
                      <span className="text-xs text-slate-400 w-9 text-right">
                        {chapterProgress?.stats.total ? `${chapterProgress.stats.accuracy}%` : '—'}
                      </span>
                    </span>
                    <Icon
                      icon={isOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                      width="18"
                      className="text-slate-400 shrink-0"
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/5 p-4 sm:p-5 space-y-2">
                      {chapter.topics.map(topic => {
                        const topicProgress = chapterProgress?.topics.find(t => t.id === topic.id);
                        const topicCoverage = getTopicCoverage(subjectId, topic.id);
                        const isActive = active?.topic.id === topic.id;
                        const isOpenTopic = openTopics.has(topic.id) || isActive;

                        return (
                          <div
                            key={topic.id}
                            className={`rounded-xl border overflow-hidden ${
                              isActive
                                ? 'border-[#f99c00]/40 bg-[#f99c00]/5'
                                : 'border-white/5 bg-black/20'
                            }`}
                          >
                            <div className="flex items-center gap-3 px-4 py-3">
                              <button
                                onClick={() => toggleTopic(topic.id)}
                                className="flex-1 min-w-0 text-left flex items-center gap-2.5"
                              >
                                <Icon
                                  icon={isOpenTopic
                                    ? 'solar:alt-arrow-down-linear'
                                    : 'solar:alt-arrow-right-linear'}
                                  width="14"
                                  className="text-slate-500 shrink-0"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold text-white truncate">
                                    {topic.name}
                                  </span>
                                  <span className="block text-xs text-slate-500">
                                    {topic.subtopics.length} subtopics
                                    {topicCoverage.total === 0 && ` · ${t('syllabus.comingSoon')}`}
                                  </span>
                                </span>
                              </button>

                              <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                                <ProgressBar pct={topicProgress?.stats.accuracy || 0} />
                              </span>
                              <Badge
                                tone={STATUS_META[topicProgress?.stats.status || 'not-started'].tone}
                                className="shrink-0"
                              >
                                {topicProgress?.stats.total
                                  ? `${topicProgress.stats.accuracy}%`
                                  : STATUS_META[topicProgress?.stats.status || 'not-started'].label}
                              </Badge>
                            </div>

                            {isOpenTopic && (
                              <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-1">
                                {topic.subtopics.map(sub => {
                                  const subProgress = topicProgress?.subtopics.find(s => s.id === sub.id);
                                  return (
                                    <div
                                      key={sub.id}
                                      className="flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-white/[0.03]"
                                    >
                                      <span className="flex-1 min-w-0 text-sm text-slate-400 truncate">
                                        {sub.name}
                                      </span>
                                      <div className="hidden sm:block w-20">
                                        <ProgressBar pct={subProgress?.stats.accuracy || 0} />
                                      </div>
                                      <span className="text-xs text-slate-500 w-10 text-right shrink-0">
                                        {subProgress?.stats.total ? `${subProgress.stats.accuracy}%` : '—'}
                                      </span>
                                    </div>
                                  );
                                })}

                                <div className="flex flex-wrap gap-2 pt-3">
                                  <TopicLink
                                    to={`/practice?level=${labelToLevelId(level)}&subject=${subjectId}&topic=${topic.id}`}
                                    disabled={topicCoverage.practice === 0}
                                    icon="solar:pen-new-square-linear"
                                    label={t('syllabus.aiPractice')}
                                    small
                                  />
                                  <TopicLink
                                    to={`/mock-exams?level=${labelToLevelId(level)}&subject=${subjectId}&topic=${topic.id}`}
                                    disabled={topicCoverage.examTotal === 0}
                                    icon="solar:document-text-linear"
                                    label={t('syllabus.topicExam')}
                                    hint={topicCoverage.examTotal}
                                    small
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* ── Coverage honesty note ─────────────────────────────────────── */}
          <p className="text-xs text-slate-500 text-center pb-4">
            {t('syllabus.coverageNote')} — {levelBadgeLabel(level)} ·{' '}
            {subjectProgress?.topicsWithContent || 0} of {subjectProgress?.topicsTotal || 0} topics
            have material ({startedPct}% of the outline attempted so far).
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5 truncate">{value}</p>
    </div>
  );
}

function TopicLink({ to, icon, label, hint, disabled, small }) {
  const className = small
    ? 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5'
    : 'px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2';

  if (disabled) {
    return (
      <span
        className={`${className} bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed`}
        title={label}
      >
        <Icon icon={icon} width={small ? 14 : 18} />
        {label}
        <span className="text-[10px] uppercase tracking-wider">· {hint === undefined ? '—' : hint}</span>
      </span>
    );
  }

  return (
    <Link
      to={to}
      className={`${className} bg-[#f99c00] text-[#0B1120] hover:bg-[#f88c00] transition-colors`}
    >
      <Icon icon={icon} width={small ? 14 : 18} />
      {label}
      {hint !== undefined && <span className="opacity-70">({hint})</span>}
    </Link>
  );
}
