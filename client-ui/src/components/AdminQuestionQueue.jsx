// Review queue for AI-generated practice scenarios.
//
// The generator writes rows with status 'pending'. Nothing a student can see
// depends on them until an admin approves one here, which is the point: a
// generated question that turns out to be unattributable, internally
// inconsistent, or simply wrong is caught by a person rather than by a student
// losing marks to it.
//
// Reads and writes both go through RLS. This component is only the interface —
// the same content_admins check decides whether the update lands, so bypassing
// the UI gains nothing.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabaseClient';
import { usePublishedScenarios } from '../hooks/usePublishedScenarios';

const PAGE_SIZE = 25;

const FILTERS = [
  { id: 'pending',   label: 'Awaiting review' },
  { id: 'published', label: 'Published' },
  { id: 'rejected',  label: 'Rejected' },
];

function SubjectTag({ subject, level }) {
  const isPhysics = subject === 'physics';
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
      style={{
        color: isPhysics ? '#7dd3fc' : '#fda4af',
        borderColor: isPhysics ? 'rgba(56,189,248,0.3)' : 'rgba(251,113,133,0.3)',
        backgroundColor: isPhysics ? 'rgba(56,189,248,0.08)' : 'rgba(251,113,133,0.08)',
      }}>
      {subject} &middot; {level}
    </span>
  );
}

function QuestionCard({ row, onApprove, onReject, busy }) {
  const [open, setOpen] = useState(false);
  const parts = Array.isArray(row.parts) ? row.parts : [];
  const scheme = Array.isArray(row.mark_scheme) ? row.mark_scheme : [];

  // Recomputed rather than read from total_marks, so a stored total that drifted
  // from its parts cannot present a paper of the wrong length to an admin
  // deciding whether to approve it.
  const computedMarks = parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
  const schemeMarks = scheme.reduce((sum, c) => sum + (Number(c.max) || 0), 0);
  const marksDisagree = schemeMarks !== 0 && schemeMarks !== computedMarks;

  return (
    <div className="bg-[#12151C] border border-white/8 rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <SubjectTag subject={row.subject} level={row.level} />
              <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 rounded-md bg-white/5 border border-white/8">
                {row.topic}
              </span>
              <span className="text-[11px] text-slate-600">difficulty {row.difficulty}/3</span>
              <span className="text-[11px] text-slate-600">{computedMarks} marks</span>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">{row.id}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {row.status === 'pending' ? (
              <>
                <button
                  onClick={() => onReject(row.id)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  <Icon icon="solar:close-circle-bold" width="14" />
                  Reject
                </button>
                <button
                  onClick={() => onApprove(row.id)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-40"
                >
                  <Icon icon="solar:check-circle-bold" width="14" />
                  Approve
                </button>
              </>
            ) : (
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                row.status === 'published'
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-red-400 border-red-500/30 bg-red-500/10'
              }`}>
                {row.status}
              </span>
            )}
          </div>
        </div>

        {marksDisagree && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Mark scheme awards {schemeMarks} but the parts total {computedMarks}. Approve with care.
          </p>
        )}

        {row.reject_reason && (
          <p className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-slate-500">Why it was not published: </span>
            {row.reject_reason}
          </p>
        )}

        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{row.stem}</p>

        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <Icon icon={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width="14" />
          {open ? 'Hide' : 'Show'} all {parts.length} part{parts.length === 1 ? '' : 's'} and {scheme.length} mark scheme row{scheme.length === 1 ? '' : 's'}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 p-4 sm:p-5 space-y-4 bg-black/20">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Question parts</h4>
            <ol className="space-y-2">
              {parts.map((p, i) => (
                <li key={i} className="text-sm text-slate-300 flex gap-3">
                  <span className="text-amber-400/70 font-mono text-xs shrink-0 w-12 pt-0.5">
                    {p.label || `(${i + 1})`}
                  </span>
                  <span className="flex-1">
                    {p.text}
                    <span className="text-slate-500 text-xs"> [{p.marks}]</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mark scheme</h4>
            <ul className="space-y-1.5">
              {scheme.map((c, i) => (
                <li key={i} className="text-sm text-slate-400 flex gap-3">
                  <span className="text-slate-600 font-mono text-xs shrink-0 w-8 pt-0.5">{i + 1}</span>
                  <span className="flex-1">
                    {c.criterion}
                    <span className="text-slate-600 text-xs"> [{c.marks}/{c.max}]</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {row.source && (
            <p className="text-xs text-slate-600">Source: {row.source}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminQuestionQueue({ onChanged }) {
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, published: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  // Re-pulling the pool after an approval is what makes a newly published
  // question appear in the pool without a reload.
  const { ready } = usePublishedScenarios();

  const fetchRows = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // RLS allows an admin to read every status, so the counts can come from
      // the same query rather than three extra round trips. Newest first keeps
      // the 500-row cap on recent history rather than freezing on the oldest
      // 500 rows once the pool is large.
      const { data, error: err } = await supabase
        .from('practice_questions')
        .select('id, subject, level, topic, topic_id, difficulty, total_marks, stem, parts, mark_scheme, status, reject_reason, source, generated_at, published_at')
        .order('generated_at', { ascending: false })
        .limit(500);

      if (err) throw err;
      setRows(data ?? []);

      const tally = { pending: 0, published: 0, rejected: 0 };
      for (const r of data ?? []) if (tally[r.status] !== undefined) tally[r.status]++;
      setCounts(tally);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const visible = useMemo(() => {
    const matches = rows.filter(r => r.status === filter);
    // Pending is a work list, so it shows the questions that have waited
    // longest first (rows arrive newest-first). Published/rejected are history,
    // where newest-first is the useful order.
    return (filter === 'pending' ? matches.reverse() : matches).slice(0, PAGE_SIZE);
  }, [rows, filter]);

  const transition = async (id, status, reason = null) => {
    setBusyId(id);
    setError('');
    try {
      const patch = {
        status,
        reviewed_at: new Date().toISOString(),
        ...(status === 'published' ? { published_at: new Date().toISOString(), reject_reason: null } : {}),
        ...(reason ? { reject_reason: reason } : {}),
      };
      const { error: err } = await supabase
        .from('practice_questions')
        .update(patch)
        .eq('id', id);
      if (err) throw err;

      await fetchRows();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const approveAllPending = async () => {
    const pending = rows.filter(r => r.status === 'pending');
    if (pending.length === 0) return;
    const ok = window.confirm(
      `Publish all ${pending.length} pending question(s) without reviewing them?\n\n` +
      'Only do this once you have spot-checked a few days of output and trust the ' +
      'validation. This skips the check that the mark scheme agrees with the parts.'
    );
    if (!ok) return;

    setBusyId('__all__');
    setError('');
    try {
      const now = new Date().toISOString();
      const { error: err } = await supabase
        .from('practice_questions')
        .update({ status: 'published', published_at: now, reviewed_at: now, reject_reason: null })
        .eq('status', 'pending');
      if (err) throw err;
      await fetchRows();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="text-base font-bold text-white flex-1">
          Review Queue
          <span className="text-slate-500 font-normal text-sm ml-2">
            Questions generated daily and waiting to be published
          </span>
        </h2>
        {counts.pending > 0 && (
          <button
            onClick={approveAllPending}
            disabled={busyId === '__all__'}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
          >
            <Icon icon="solar:checklist-bold" width="16" />
            Publish all {counts.pending}
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/8 rounded-xl">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === f.id ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            {f.label}
            <span className="text-xs opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 py-8 text-center">Loading queue…</p>
      ) : !ready ? (
        <p className="text-sm text-slate-500 py-8 text-center">Waiting for the question pool to load…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Icon icon="solar:inbox-bold" width="32" className="mx-auto mb-3 opacity-30" />
          <p>
            {filter === 'pending'
              ? 'Nothing awaiting review. The generator runs once a day; new questions appear here after it finishes.'
              : `No ${filter} questions.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(row => (
            <QuestionCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onApprove={id => transition(id, 'published')}
              onReject={id => transition(id, 'rejected', 'Rejected by an admin.')}
            />
          ))}
        </div>
      )}

      {rows.length >= 500 && (
        <p className="text-xs text-slate-600 text-center">
          Showing the {PAGE_SIZE} most recent of at least {rows.length} rows. Archive old
          questions by rejecting them, or query the table directly for a full history.
        </p>
      )}
    </div>
  );
}
