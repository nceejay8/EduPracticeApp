import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Badge } from '../components/ui';
import { SUBJECT_IDS, listTopics } from '../data/syllabus';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { PRACTICE_SCENARIOS, getCustomScenarios, saveCustomScenario, deleteCustomScenario, getCustomMockExams, saveCustomMockExam, deleteCustomMockExam } from '../data/practiceScenarios';
import { invalidateCoverage } from '../data/syllabusProgress';
import { getPublishedScenarios } from '../data/publishedScenarios';
import AdminQuestionQueue from '../components/AdminQuestionQueue';
import MathText from '../components/MathText';
import { useAuth } from '../contexts/AuthContext';

const SUBJECTS   = ['physics', 'mathematics'];
const LEVELS     = ['A-Level', 'UACE'];

// Derived from the canonical syllabus so a scenario created here always lands
// on a real topic. Saving an ad-hoc topic string would produce content that
// resolveContentRef() can never place on the outline, so it would silently
// never show up on /syllabus.
const TOPICS_MAP = Object.fromEntries(
  SUBJECT_IDS.map(id => [id, listTopics(id).map(t => t.name)])
);

function useForceUpdate() {
  const [, set] = useState(0);
  return () => set(n => n + 1);
}

// ─── Empty part row ────────────────────────────────────────────────────────
const emptyPart = () => ({ label: '', text: '', marks: 1 });
const emptyMark = () => ({ criterion: '', marks: 1, max: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS GATE
// ─────────────────────────────────────────────────────────────────────────────
// Replaces a hardcoded PIN that was compiled into the bundle and printed on this
// screen. Access is now decided by the `content_admins` table, which has no
// INSERT policy — so the only way in is to add your own user id in the Supabase
// SQL editor. See supabase/migrations/20261001_practice_questions.sql.
//
// This component controls what is rendered. It is not the security boundary:
// practice_questions enforces the same check in RLS, so a student who reaches
// this page by editing localStorage still cannot publish anything.
function AccessGate({ state }) {
  const notVerified = state.error === 'not-verified';

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:shield-bold" width="32" className="text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Admin Access</h1>

        {state.loading ? (
          <p className="text-sm text-slate-400 mt-3">Checking your access…</p>
        ) : (
          <>
            <p className="text-sm text-slate-400 mt-3">
              {notVerified
                ? 'Could not verify your access. The admin allowlist may not be set up on this project yet.'
                : 'This account is not on the admin allowlist.'}
            </p>
            {notVerified && (
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Run <span className="text-slate-400">supabase/migrations/20261001_practice_questions.sql</span>{' '}
                in the Supabase SQL editor, then add your user id to{' '}
                <span className="text-slate-400">content_admins</span>.
              </p>
            )}
          </>
        )}

        <Link
          to="/"
          className="inline-block mt-8 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Back to EduPractice
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO CARD (read-only)
// ─────────────────────────────────────────────────────────────────────────────
function ScenarioCard({ scenario, isCustom, onDelete }) {
  const [open, setOpen] = useState(false);
  const sub = scenario.subject === 'physics' ? 'blue' : 'rose';
  return (
    <div className="bg-[#12151C] border border-white/8 rounded-2xl overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${scenario.subject === 'physics' ? 'bg-blue-500/15' : 'bg-rose-500/15'}`}>
          <Icon icon={scenario.subject === 'physics' ? 'solar:atom-bold' : 'solar:calculator-bold'} width="16" className={scenario.subject === 'physics' ? 'text-blue-400' : 'text-rose-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge tone={sub}>{scenario.subject}</Badge>
            <Badge tone="amber">{scenario.level}</Badge>
            <Badge tone={scenario.difficulty === 3 ? 'rose' : scenario.difficulty === 2 ? 'amber' : 'emerald'}>
              {scenario.difficulty === 1 ? 'Easy' : scenario.difficulty === 2 ? 'Medium' : 'Hard'}
            </Badge>
            {isCustom && <Badge tone="violet">Custom</Badge>}
          </div>
          <p className="text-sm font-semibold text-white truncate">{scenario.topic}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{scenario.stem?.slice(0, 80)}…</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-slate-500">{scenario.totalMarks} marks</span>
          <Icon icon={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width="16" className="text-slate-500" />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Stem / Context</p>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap"><MathText text={scenario.stem} /></p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Parts</p>
            <div className="space-y-2">
              {(scenario.parts || []).map((p, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="font-bold text-amber-400 shrink-0 w-8">({p.label})</span>
                  <MathText className="text-slate-300 flex-1" text={p.text} />
                  <span className="text-slate-500 shrink-0">[{p.marks} mk]</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mark Scheme</p>
            <div className="space-y-1.5">
              {(scenario.markScheme || []).map((m, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">{m.max}</span>
                  <MathText className="text-slate-400" text={m.criterion} />
                </div>
              ))}
            </div>
          </div>

          {scenario.source && (
            <p className="text-xs text-slate-600 italic">Source: {scenario.source}</p>
          )}

          {isCustom && (
            <button
              onClick={() => onDelete(scenario.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
            >
              <Icon icon="solar:trash-bin-trash-bold" width="14" />
              Delete this scenario
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD SCENARIO FORM
// ─────────────────────────────────────────────────────────────────────────────
function AddScenarioForm({ onSaved }) {
  const [form, setForm] = useState({
    subject: 'physics',
    topic: TOPICS_MAP.physics[0],
    level: 'A-Level',
    difficulty: 2,
    source: '',
    stem: '',
    parts: [emptyPart()],
    markScheme: [emptyMark()],
  });
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setPart = (i, k, v) => {
    const parts = [...form.parts];
    parts[i] = { ...parts[i], [k]: v };
    setForm(f => ({ ...f, parts }));
  };
  const addPart    = () => setForm(f => ({ ...f, parts: [...f.parts, emptyPart()] }));
  const removePart = i  => setForm(f => ({ ...f, parts: f.parts.filter((_, j) => j !== i) }));

  const setMark = (i, k, v) => {
    const markScheme = [...form.markScheme];
    markScheme[i] = { ...markScheme[i], [k]: v };
    setForm(f => ({ ...f, markScheme }));
  };
  const addMark    = () => setForm(f => ({ ...f, markScheme: [...f.markScheme, emptyMark()] }));
  const removeMark = i  => setForm(f => ({ ...f, markScheme: f.markScheme.filter((_, j) => j !== i) }));

  const totalMarks = form.parts.reduce((s, p) => s + (parseInt(p.marks) || 0), 0);

  const handleSave = () => {
    if (!form.stem.trim()) return alert('Please enter a question stem.');
    if (form.parts.some(p => !p.text.trim())) return alert('All parts need question text.');
    const id = `custom-${form.subject}-${Date.now()}`;
    saveCustomScenario({ ...form, id, totalMarks, difficulty: parseInt(form.difficulty) });
    // New content changes what /syllabus can offer, so drop the coverage memo.
    invalidateCoverage();
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1200);
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.07] text-sm transition-all';
  const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="bg-[#12151C] border border-white/8 rounded-2xl p-6 space-y-6">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Icon icon="solar:add-circle-bold" width="18" className="text-amber-400" />
        New Scenario
      </h3>

      {/* Row 1: Subject / Topic / Level / Difficulty */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>Subject</label>
          <select className={inputCls} value={form.subject}
            onChange={e => { set('subject', e.target.value); set('topic', TOPICS_MAP[e.target.value][0]); }}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className={labelCls}>Topic</label>
          <select className={inputCls} value={form.topic} onChange={e => set('topic', e.target.value)}>
            {(TOPICS_MAP[form.subject] || []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Level</label>
          <select className={inputCls} value={form.level} onChange={e => set('level', e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Difficulty</label>
          <select className={inputCls} value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            <option value={1}>1 — Easy</option>
            <option value={2}>2 — Medium</option>
            <option value={3}>3 — Hard</option>
          </select>
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={labelCls}>Source / Attribution</label>
          <input className={inputCls} value={form.source} onChange={e => set('source', e.target.value)}
            placeholder="e.g. UACE 2024 Paper 1 — Q3" />
        </div>
      </div>

      {/* Stem */}
      <div>
        <label className={labelCls}>Question Stem / Context</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={4}
          value={form.stem}
          onChange={e => set('stem', e.target.value)}
          placeholder="The introductory paragraph, scenario description, or given data that all parts share…"
        />
      </div>

      {/* Parts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls + ' mb-0'}>Question Parts</label>
          <span className="text-xs text-slate-500">Total: {totalMarks} marks</span>
        </div>
        <div className="space-y-3">
          {form.parts.map((p, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                className={`${inputCls} w-16 shrink-0 text-center font-bold`}
                value={p.label}
                onChange={e => setPart(i, 'label', e.target.value)}
                placeholder="a"
              />
              <input
                className={`${inputCls} flex-1`}
                value={p.text}
                onChange={e => setPart(i, 'text', e.target.value)}
                placeholder="Question text for this part…"
              />
              <input
                className={`${inputCls} w-20 shrink-0 text-center`}
                type="number"
                min="1"
                max="20"
                value={p.marks}
                onChange={e => setPart(i, 'marks', parseInt(e.target.value) || 1)}
                placeholder="Marks"
              />
              {form.parts.length > 1 && (
                <button onClick={() => removePart(i)}
                  className="w-8 h-[38px] rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center shrink-0 transition-colors">
                  <Icon icon="solar:close-circle-bold" width="14" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addPart}
          className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors">
          <Icon icon="solar:add-circle-linear" width="14" />
          Add part
        </button>
      </div>

      {/* Mark Scheme */}
      <div>
        <label className={labelCls}>Mark Scheme Criteria</label>
        <div className="space-y-2">
          {form.markScheme.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className={`${inputCls} w-16 shrink-0 text-center`}
                type="number" min="1" max="5"
                value={m.max}
                onChange={e => setMark(i, 'max', parseInt(e.target.value) || 1)}
                placeholder="Max"
                title="Max marks for this criterion"
              />
              <input
                className={`${inputCls} flex-1`}
                value={m.criterion}
                onChange={e => setMark(i, 'criterion', e.target.value)}
                placeholder="Marking criterion description…"
              />
              {form.markScheme.length > 1 && (
                <button onClick={() => removeMark(i)}
                  className="w-8 h-[38px] rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center shrink-0 transition-colors">
                  <Icon icon="solar:close-circle-bold" width="14" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addMark}
          className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          <Icon icon="solar:add-circle-linear" width="14" />
          Add criterion
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
          saved ? 'bg-emerald-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'
        }`}
      >
        {saved ? '✓ Saved!' : `Save Scenario (${totalMarks} marks)`}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD MOCK EXAM FORM
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_TONES = ['sky', 'violet', 'amber', 'emerald', 'rose'];
const MOCK_ICONS = [
  'solar:atom-bold', 'solar:calculator-bold', 'solar:star-bold',
  'solar:target-bold', 'solar:book-2-bold',
];

function AddMockForm({ onSaved }) {
  const [form, setForm] = useState({
    title: '',
    subject: 'Physics',
    level: 'A-Level',
    difficulty: 'Hard',
    duration: '2h',
    count: 10,
    scenarioCount: 2,
    description: '',
    icon: 'solar:atom-bold',
    tone: 'sky',
  });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) return alert('Please enter a title.');
    const id = `custom-mock-${Date.now()}`;
    saveCustomMockExam({ ...form, id, count: parseInt(form.count), scenarioCount: parseInt(form.scenarioCount) });
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1200);
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.07] text-sm transition-all';
  const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="bg-[#12151C] border border-white/8 rounded-2xl p-6 space-y-6">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Icon icon="solar:add-circle-bold" width="18" className="text-violet-400" />
        New Mock Exam
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Physics — UACE Full Mock 2025" />
        </div>
        <div>
          <label className={labelCls}>Subject</label>
          <select className={inputCls} value={form.subject} onChange={e => set('subject', e.target.value)}>
            <option>Physics</option>
            <option>Mathematics</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Level</label>
          <select className={inputCls} value={form.level} onChange={e => set('level', e.target.value)}>
            <option>A-Level</option>
            <option>UACE</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Difficulty</label>
          <select className={inputCls} value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Duration</label>
          <input className={inputCls} value={form.duration} onChange={e => set('duration', e.target.value)}
            placeholder="2h 30min" />
        </div>
        <div>
          <label className={labelCls}>Total Questions</label>
          <input className={inputCls} type="number" min="5" max="40"
            value={form.count} onChange={e => set('count', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Scenario Questions</label>
          <input className={inputCls} type="number" min="0" max="10"
            value={form.scenarioCount} onChange={e => set('scenarioCount', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Description</label>
          <textarea className={`${inputCls} resize-none`} rows={2}
            value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Brief description of what this mock exam covers…" />
        </div>
        <div>
          <label className={labelCls}>Icon</label>
          <div className="flex flex-wrap gap-2">
            {MOCK_ICONS.map(ic => (
              <button key={ic} onClick={() => set('icon', ic)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${form.icon === ic ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                <Icon icon={ic} width="18" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Colour Theme</label>
          <div className="flex gap-2">
            {MOCK_TONES.map(t => {
              const cols = { sky: 'bg-sky-500', violet: 'bg-violet-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500' };
              return (
                <button key={t} onClick={() => set('tone', t)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${cols[t]} ${form.tone === t ? 'border-white scale-110' : 'border-transparent opacity-50'}`} />
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={handleSave}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
          saved ? 'bg-emerald-500 text-white' : 'bg-violet-500 hover:bg-violet-400 text-white'
        }`}>
        {saved ? '✓ Saved!' : 'Save Mock Exam'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK EXAM CARD
// ─────────────────────────────────────────────────────────────────────────────
function MockCard({ exam, isCustom, onDelete }) {
  const TONE_COLORS = {
    sky:     'text-sky-300 bg-sky-500/10 border-sky-500/30',
    violet:  'text-violet-300 bg-violet-500/10 border-violet-500/30',
    amber:   'text-amber-300 bg-amber-500/10 border-amber-500/30',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    rose:    'text-rose-300 bg-rose-500/10 border-rose-500/30',
  };
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${TONE_COLORS[exam.tone] || TONE_COLORS.sky} bg-gradient-to-r`}>
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        <Icon icon={exam.icon || 'solar:atom-bold'} width="20" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{exam.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{exam.subject} · {exam.level} · {exam.duration} · {exam.count}Q</p>
        {exam.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{exam.description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isCustom && <Badge tone="violet">Custom</Badge>}
        {isCustom && (
          <button onClick={() => onDelete(exam.id)}
            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
            <Icon icon="solar:trash-bin-trash-bold" width="14" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT TAB
// ─────────────────────────────────────────────────────────────────────────────
function ImportExport({ onImported }) {
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  const handleExport = () => {
    const data = { scenarios: getCustomScenarios(), mockExams: getCustomMockExams(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `edupractice-content-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported successfully.');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let count  = 0;
        if (Array.isArray(data.scenarios)) {
          data.scenarios.forEach(s => saveCustomScenario(s));
          count += data.scenarios.length;
        }
        if (Array.isArray(data.mockExams)) {
          data.mockExams.forEach(m => saveCustomMockExam(m));
          count += data.mockExams.length;
        }
        setStatus(`Imported ${count} items successfully.`);
        onImported();
      } catch {
        setStatus('Error: invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearCustom = () => {
    if (!window.confirm('Delete ALL custom scenarios and mock exams? This cannot be undone.')) return;
    localStorage.removeItem('eduPractice_customScenarios');
    localStorage.removeItem('eduPractice_customMockExams');
    setStatus('All custom content cleared.');
    onImported();
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#12151C] border border-white/8 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Export Custom Content</h3>
        <p className="text-xs text-slate-400">Download all your custom scenarios and mock exams as a JSON file for backup or migration.</p>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 transition-colors">
          <Icon icon="solar:download-bold" width="16" />
          Export JSON
        </button>
      </div>

      <div className="bg-[#12151C] border border-white/8 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Import Content</h3>
        <p className="text-xs text-slate-400">Upload a previously exported JSON file. Items with duplicate IDs will be overwritten.</p>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/25 transition-colors">
          <Icon icon="solar:upload-bold" width="16" />
          Import JSON File
        </button>
      </div>

      <div className="bg-[#12151C] border border-red-500/20 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-red-400">Danger Zone</h3>
        <p className="text-xs text-slate-400">Remove all custom scenarios and mock exams from this device. Built-in content is not affected.</p>
        <button onClick={handleClearCustom}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors">
          <Icon icon="solar:trash-bin-trash-bold" width="16" />
          Clear all custom content
        </button>
      </div>

      {status && (
        <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300">
          {status}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const BUILT_IN_MOCKS = [
  { id: 'mock-physics-al',   title: 'Physics — A-Level Mock',      subject: 'Physics',      level: 'A-Level', difficulty: 'Hard', duration: '2h', count: 10, scenarioCount: 2, icon: 'solar:atom-bold',       tone: 'sky',    description: 'Classical mechanics, optics and modern physics with applied scenarios.' },
  { id: 'mock-math-al',      title: 'Mathematics — A-Level Mock',  subject: 'Mathematics',  level: 'A-Level', difficulty: 'Hard', duration: '2h', count: 10, scenarioCount: 2, icon: 'solar:calculator-bold',  tone: 'violet', description: 'Pure and applied mathematics, statistics and probability with applied scenarios.' },
];

export default function Admin() {
  // Was `sessionStorage.getItem(ADMIN_PIN_KEY) === '1'`, which meant a PIN
  // compiled into the bundle. Now it is a lookup against the admin allowlist,
  // which the database also enforces via RLS on the tables this page writes to.
  const admin = useIsAdmin();
  const { logOut } = useAuth();
  const [tab, setTab]           = useState('queue');
  const [showAddScenario, setShowAddScenario] = useState(false);
  const [showAddMock,     setShowAddMock]     = useState(false);
  const [filterSubject, setFilterSubject]     = useState('all');
  const forceUpdate = useForceUpdate();

  const customScenarios = useMemo(() => getCustomScenarios(), [admin.isAdmin, forceUpdate]);
  const customMocks     = useMemo(() => getCustomMockExams(),  [admin.isAdmin, forceUpdate]);
  const published       = getPublishedScenarios();

  const allScenarios = useMemo(() => {
    const all = [...PRACTICE_SCENARIOS, ...getCustomScenarios(), ...getPublishedScenarios()];
    if (filterSubject === 'all') return all;
    return all.filter(s => s.subject === filterSubject);
  }, [filterSubject, admin.isAdmin]);

  const refresh = () => forceUpdate();

  if (admin.loading) return null;
  if (!admin.isAdmin) return <AccessGate state={admin} />;

  const TABS = [
    { id: 'queue',    label: 'Review Queue', icon: 'solar:inbox-bold' },
    { id: 'scenarios',  label: 'Scenarios', icon: 'solar:document-text-bold' },
    { id: 'mocks',      label: 'Mock Exams', icon: 'solar:target-bold' },
    { id: 'importexport', label: 'Import / Export', icon: 'solar:transfer-horizontal-bold' },
  ];

  const statsItems = [
    { label: 'Built-in Scenarios', value: PRACTICE_SCENARIOS.length,  icon: 'solar:library-bold',    color: 'text-blue-400' },
    { label: 'Generated (live)',   value: published.length,           icon: 'solar:stars-minimalistic-bold', color: 'text-emerald-400' },
    { label: 'Custom Scenarios',   value: customScenarios.length,     icon: 'solar:add-circle-bold', color: 'text-amber-400' },
    { label: 'Custom Mocks',       value: customMocks.length,         icon: 'solar:star-bold',       color: 'text-violet-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0B1120]/95 backdrop-blur border-b border-white/5 px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/"
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <Icon icon="solar:alt-arrow-left-linear" width="18" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Icon icon="solar:shield-bold" width="16" className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Admin Panel</p>
              <p className="text-xs text-slate-500 leading-none mt-0.5">EduPractice Content Management</p>
            </div>
          </div>
        </div>

        {/* Was "Lock", which cleared the PIN from sessionStorage. There is no
            unlock state to return to any more — access follows the signed-in
            account — so this is just a way to end the session on a shared
            machine, which is the thing the button was really for. */}
        <button
          onClick={logOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Icon icon="solar:logout-2-bold" width="14" />
          Sign out
        </button>
      </header>

      <div className="flex-1 px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statsItems.map((s, i) => (
            <div key={i} className="bg-[#12151C] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <Icon icon={s.icon} width="20" className={s.color} />
              <div>
                <p className="text-xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/8 rounded-xl">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-white'
              }`}>
              <Icon icon={t.icon} width="15" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Review queue ── */}
        {tab === 'queue' && (
          <AdminQuestionQueue onChanged={refresh} />
        )}

        {/* ── Scenarios tab ── */}
        {tab === 'scenarios' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-base font-bold text-white flex-1">
                Scenarios <span className="text-slate-500 font-normal text-sm">({allScenarios.length} shown)</span>
              </h2>
              <div className="flex items-center gap-2">
                {/* Filter */}
                <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/8 rounded-lg">
                  {['all', 'physics', 'mathematics'].map(f => (
                    <button key={f} onClick={() => setFilterSubject(f)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                        filterSubject === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                      }`}>{f}</button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAddScenario(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    showAddScenario ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon icon={showAddScenario ? 'solar:close-circle-bold' : 'solar:add-circle-bold'} width="16" />
                  {showAddScenario ? 'Cancel' : 'Add New'}
                </button>
              </div>
            </div>

            {showAddScenario && (
              <AddScenarioForm onSaved={() => { setShowAddScenario(false); refresh(); }} />
            )}

            <div className="space-y-3">
              {allScenarios.map(s => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  // A generated scenario is not editable from here. Retiring one
                  // is a status change in the Review Queue, not a localStorage
                  // delete — otherwise retiring it would leave it live for
                  // students, and "delete" would suggest a removal that never
                  // happened.
                  isCustom={!s.generated && getCustomScenarios().some(c => c.id === s.id)}
                  onDelete={id => { deleteCustomScenario(id); invalidateCoverage(); refresh(); }}
                />
              ))}
              {allScenarios.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Icon icon="solar:library-bold" width="32" className="mx-auto mb-3 opacity-30" />
                  <p>No scenarios match this filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mock Exams tab ── */}
        {tab === 'mocks' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white flex-1">Mock Exams</h2>
              <button
                onClick={() => setShowAddMock(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  showAddMock ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon icon={showAddMock ? 'solar:close-circle-bold' : 'solar:add-circle-bold'} width="16" />
                {showAddMock ? 'Cancel' : 'Add New'}
              </button>
            </div>

            {showAddMock && (
              <AddMockForm onSaved={() => { setShowAddMock(false); refresh(); }} />
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Built-in</p>
              <div className="space-y-3">
                {BUILT_IN_MOCKS.map(m => <MockCard key={m.id} exam={m} isCustom={false} />)}
              </div>
            </div>

            {getCustomMockExams().length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Custom</p>
                <div className="space-y-3">
                  {getCustomMockExams().map(m => (
                    <MockCard key={m.id} exam={m} isCustom onDelete={id => { deleteCustomMockExam(id); refresh(); }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Import/Export tab ── */}
        {tab === 'importexport' && (
          <ImportExport onImported={refresh} />
        )}
      </div>
    </div>
  );
}
