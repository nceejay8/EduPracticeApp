// Small presentational primitives shared across pages.
//
// These were previously copy-pasted as local helpers inside MockExams.jsx and
// Admin.jsx. Extracted here so the new Syllabus page does not become a third
// copy of the same pill / badge / empty-state markup, and so fixes land once.

import React from 'react';
import { Icon } from '@iconify/react';

// ─── Pill ────────────────────────────────────────────────────────────────────
// Compact metadata chip. Dark-background variant (MockExams) is the default.
export function Pill({ icon, children, className = '', tone = 'dark' }) {
  const tones = {
    dark: 'bg-black/30 border-white/5',
    light: 'bg-white/5 border-white/10',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tones[tone] || tones.dark} ${className}`}>
      {icon && <Icon icon={icon} width="14" />}
      {children}
    </span>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
// Tinted status pill. `tone` matches the keys used for mastery status.
export function Badge({ children, tone = 'slate', icon, className = '' }) {
  const tones = {
    blue:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
    rose:    'bg-rose-500/15 text-rose-300 border-rose-500/30',
    amber:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
    violet:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
    slate:   'bg-white/5 text-slate-400 border-white/10',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${tones[tone] || tones.slate} ${className}`}>
      {icon && <Icon icon={icon} width="12" />}
      {children}
    </span>
  );
}

// ─── Progress bar ────────────────────────────────────────────────────────────
// Matches the bar style used for the daily goal on the dashboard so the two
// read as the same component.
export function ProgressBar({ pct, from = 'from-[#f99c00]', to = 'to-[#f88c00]', className = '' }) {
  const width = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className={`h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 ${className}`}>
      <div
        className={`h-full bg-gradient-to-r ${from} ${to} rounded-full transition-all`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// Accuracy bars use the 80 / 50 thresholds from ExamResults.jsx.
export function accuracyTone(pct) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (pct >= 50) return { bar: 'bg-[#f99c00]', text: 'text-[#f99c00]' };
  return { bar: 'bg-rose-500', text: 'text-rose-400' };
}

export function AccuracyBar({ pct }) {
  const tone = accuracyTone(pct);
  return (
    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
      <div
        className={`h-full ${tone.bar} rounded-full transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%` }}
      />
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ title, hint, icon = 'solar:document-text-linear' }) {
  return (
    <div className="text-center py-10 px-5 bg-white/5 rounded-xl border border-white/5">
      <Icon icon={icon} width="32" className="text-slate-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#111827] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 sm:p-7 max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <Icon icon="solar:close-circle-linear" width="22" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Subject icon ────────────────────────────────────────────────────────────
export function subjectIcon(subject) {
  switch (subject) {
    case 'Physics': return 'solar:atom-bold';
    case 'Mathematics': return 'solar:calculator-bold';
    default: return 'solar:book-2-bold';
  }
}
