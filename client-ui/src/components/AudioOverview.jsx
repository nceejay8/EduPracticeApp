import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { callGemini, isAvailable } from '../services/geminiService';
import { checkAndRecord } from '../utils/rateLimiter';

const SPEEDS = [0.8, 1.0, 1.25, 1.5, 1.75];

function WaveformBars({ playing }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {Array.from({ length: 20 }).map((_, i) => {
        const baseH = [60, 40, 80, 55, 90, 45, 70, 35, 85, 50, 75, 42, 88, 58, 65, 38, 78, 48, 82, 52][i];
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-violet-400 origin-bottom transition-all"
            style={{
              height: playing ? `${baseH}%` : '25%',
              opacity: playing ? 0.9 : 0.3,
              animation: playing ? `waveBar ${0.6 + (i % 5) * 0.12}s ease-in-out ${(i * 0.04) % 0.5}s infinite alternate` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

const waveKeyframes = `
@keyframes waveBar {
  from { transform: scaleY(0.4); }
  to   { transform: scaleY(1); }
}
`;

export default function AudioOverview({ topic, subject, level, description, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | playing | paused | done | error
  const [script, setScript] = useState('');
  const [sentences, setSentences] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);

  const speed = SPEEDS[speedIdx];

  const splitSentences = (text) =>
    text.match(/[^.!?…]+[.!?…]+[\s]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

  const generateScript = useCallback(async () => {
    const rl = checkAndRecord('audioOverview');
    if (rl.blocked) {
      setErrorMsg(`Too many audio overview requests. Please wait ${Math.ceil(rl.retryAfterMs / 60000)} minute(s) before generating another.`);
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const system = [
        'You are an expert A-Level tutor specialising in Uganda curriculum Physics and Mathematics.',
        'Write a clear, engaging 4-paragraph spoken explanation of the given topic.',
        'Use simple language. Give real-world Uganda examples where helpful.',
        'No markdown — plain paragraphs only. Aim for 350-450 words.',
        'Structure: (1) big picture/why it matters, (2) core concept explained simply,',
        '(3) key formula or method with a worked step, (4) exam tips.',
      ].join(' ');

      const prompt = `Topic: ${topic}\nSubject: ${subject}\nLevel: ${level}${description ? `\nContext: ${description}` : ''}`;
      const text = await callGemini(
        [{ role: 'user', parts: [{ text: prompt }] }],
        system,
        { temperature: 0.65, maxOutputTokens: 700 }
      );
      setScript(text);
      setSentences(splitSentences(text));
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate overview.');
      setStatus('error');
    }
  }, [topic, subject, level, description]);

  const speakFrom = useCallback((idx) => {
    synthRef.current.cancel();
    if (idx >= sentences.length) { setStatus('done'); setCurrentIdx(sentences.length - 1); return; }
    setCurrentIdx(idx);
    const utt = new SpeechSynthesisUtterance(sentences[idx]);
    utt.rate = speed;
    utt.pitch = 1.0;
    utt.lang = 'en-GB';
    utt.onend = () => speakFrom(idx + 1);
    utt.onerror = () => {};
    utteranceRef.current = utt;
    synthRef.current.speak(utt);
    setStatus('playing');
  }, [sentences, speed]);

  const play = () => {
    if (status === 'paused') {
      synthRef.current.resume();
      setStatus('playing');
    } else {
      speakFrom(status === 'done' ? 0 : currentIdx);
    }
  };

  const pause = () => {
    synthRef.current.pause();
    setStatus('paused');
  };

  const stop = () => {
    synthRef.current.cancel();
    setCurrentIdx(0);
    setStatus('ready');
  };

  // Update rate on speed change while playing
  useEffect(() => {
    if (status === 'playing') {
      const idx = currentIdx;
      synthRef.current.cancel();
      setTimeout(() => speakFrom(idx), 50);
    }
  }, [speed]);

  useEffect(() => {
    return () => synthRef.current.cancel();
  }, []);

  const isPlaying = status === 'playing';
  const progress = sentences.length > 0 ? Math.round((currentIdx / sentences.length) * 100) : 0;

  return (
    <>
      <style>{waveKeyframes}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
        onClick={(e) => { if (e.target === e.currentTarget) { stop(); onClose(); } }}>

        {/* Panel */}
        <div className="w-full sm:max-w-lg bg-[#0f1219] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Icon icon="solar:headphones-round-bold" width="16" className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Audio Overview</p>
                <p className="text-xs text-slate-500 truncate max-w-[200px]">{topic}</p>
              </div>
            </div>
            <button onClick={() => { stop(); onClose(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.07] transition-all">
              <Icon icon="solar:close-circle-linear" width="18" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-5">

            {/* Idle — generate button */}
            {status === 'idle' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto">
                  <Icon icon="solar:soundwave-bold" width="28" className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Ready to generate your overview</p>
                  <p className="text-xs text-slate-500">Maestro will create a spoken explanation of <span className="text-slate-300">{topic}</span> tailored to {level}.</p>
                </div>
                {!isAvailable() && (
                  <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    This feature needs the app to be connected to the server, and it is not right now.
                  </p>
                )}
                <button
                  onClick={generateScript}
                  disabled={!isAvailable()}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all active:scale-[0.98]"
                >
                  Generate Overview
                </button>
              </div>
            )}

            {/* Loading */}
            {status === 'loading' && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin mx-auto" />
                <p className="text-sm text-slate-400">Maestro is preparing your audio overview…</p>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="text-center py-6 space-y-3">
                <Icon icon="solar:danger-circle-bold" width="32" className="text-red-400 mx-auto" />
                <p className="text-xs text-red-300">{errorMsg}</p>
                <button onClick={generateScript} className="text-sm font-semibold text-violet-400 hover:text-violet-300">Try again</button>
              </div>
            )}

            {/* Player */}
            {['ready', 'playing', 'paused', 'done'].includes(status) && (
              <div className="space-y-4">
                {/* Waveform + progress */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <WaveformBars playing={isPlaying} />
                    <div className="text-right">
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider">Progress</p>
                      <p className="text-sm font-bold text-slate-300 tabular-nums">{progress}%</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {/* Current sentence */}
                  {sentences[currentIdx] && (
                    <p className="text-xs text-slate-400 leading-relaxed italic line-clamp-2">
                      "{sentences[currentIdx]}"
                    </p>
                  )}
                  {status === 'done' && (
                    <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Icon icon="solar:check-circle-bold" width="13" /> Overview complete
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Restart */}
                  <button
                    onClick={stop}
                    className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    title="Restart"
                  >
                    <Icon icon="solar:restart-bold" width="18" />
                  </button>

                  {/* Play / Pause */}
                  <button
                    onClick={isPlaying ? pause : play}
                    className="w-14 h-14 rounded-2xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center text-white shadow-lg shadow-violet-900/40 transition-all active:scale-95"
                  >
                    <Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} width="22" />
                  </button>

                  {/* Skip 10s forward (next sentence) */}
                  <button
                    onClick={() => speakFrom(Math.min(sentences.length - 1, currentIdx + 3))}
                    className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    title="Skip forward"
                  >
                    <Icon icon="solar:forward-bold" width="18" />
                  </button>
                </div>

                {/* Speed selector */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider mr-1">Speed</span>
                  {SPEEDS.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => setSpeedIdx(i)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                        speedIdx === i
                          ? 'bg-violet-600/30 border-violet-500/50 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.07] text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>

                {/* Script text (collapsed, expandable) */}
                <details className="group">
                  <summary className="text-[11px] text-slate-600 hover:text-slate-400 cursor-pointer list-none flex items-center gap-1 select-none">
                    <Icon icon="solar:alt-arrow-right-linear" width="11" className="group-open:rotate-90 transition-transform" />
                    Read transcript
                  </summary>
                  <div className="mt-2 px-3 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 leading-relaxed max-h-40 overflow-y-auto">
                    {script}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
