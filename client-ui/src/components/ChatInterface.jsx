import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiLearningIcon } from '@hugeicons/core-free-icons';
import MarkdownText from './MarkdownText';
import { streamGemini, isAvailable } from '../services/geminiService';
import { browserIsOnline } from '../hooks/useOnlineStatus';
import { checkAndRecord, blockedMessage } from '../utils/rateLimiter';

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'assistant',
    text: "Hello! I'm Maestro, your AI study assistant. I'm here to help you understand concepts, solve problems, or answer any questions about your practice session. What would you like to explore?",
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

function Avatar({ role }) {
  if (role === 'assistant') {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f99c00] to-amber-600 flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={AiLearningIcon} size={16} strokeWidth={2} className="text-white" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
      S
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar role={msg.role} />
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm ${
            isUser
              ? 'bg-[#f99c00] text-[#0B1120] rounded-br-md font-medium leading-relaxed'
              : 'bg-white/[0.06] border border-white/[0.09] text-slate-200 rounded-bl-md'
          }`}
        >
          {isUser ? (
            <p className="leading-relaxed">{msg.text}</p>
          ) : (
            <MarkdownText content={msg.text} compact className="text-slate-200" />
          )}
        </div>
        <span className={`text-[10px] text-slate-500 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {msg.time}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <Avatar role="assistant" />
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-[#f99c00] rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
    </div>
  );
}

function ModelSearchingIndicator() {
  const [currentModel, setCurrentModel] = useState(0);
  const models = [
    'Llama 3.2',
    'WizardLM',
    'Gemma 7B',
    'Mistral',
    'Zephyr'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentModel((prev) => (prev + 1) % models.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 items-start">
      <Avatar role="assistant" />
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-[#f99c00] rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-300 font-medium">
            Finding best AI model...
          </span>
          <span className="text-xs text-[#f99c00] font-mono">
            {models[currentModel]}
          </span>
        </div>
      </div>
    </div>
  );
}

function buildSystemPrompt(context) {
  const base = [
    'You are Maestro, a friendly expert A-Level tutor for Uganda UACE curriculum.',
    'You specialise in Physics and Mathematics at A-Level / S5–S6 standard.',
    'Give clear, step-by-step explanations. Use LaTeX notation for formulas (e.g. $F = ma$).',
    'Reference Uganda exam board marking schemes where relevant.',
    'Keep answers concise and well-structured using markdown.',
    'Never reveal you are an AI model — you are Maestro, the student\'s personal tutor.',
  ].join(' ');

  if (!context) return base;

  const parts = [base, `\n\nCurrent practice session:`];
  if (context.subject) parts.push(`- Subject: ${context.subject}`);
  if (context.level)   parts.push(`- Level: ${context.level}`);
  if (context.topic)   parts.push(`- Topic: ${context.topic}`);
  if (context.stem)    parts.push(`- Question stem: ${context.stem}`);
  if (context.parts)   parts.push(`- Question parts:\n${context.parts}`);
  parts.push('\nHelp the student understand this question. Guide without giving the full answer immediately.');
  return parts.join('\n');
}

export default function ChatInterface({ isOpen, onClose, initialMessage, context }) {
  const [messages, setMessages] = useState(() => {
    if (initialMessage) {
      return [{
        id: 1,
        role: 'assistant',
        text: initialMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }];
    }
    return INITIAL_MESSAGES;
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSearchingModels, setIsSearchingModels] = useState(false);
  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isTyping || messages.length) scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || isStreaming) return;

    // Rate limit: 12 messages per 5 minutes
    const rl = checkAndRecord('aiChat');
    if (rl.blocked) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          text: `You're sending messages too quickly. Please wait ${Math.ceil(rl.retryAfterMs / 1000)} seconds before sending another message.`,
          time: timeStr,
        },
      ]);
      return;
    }

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSearchingModels(true);
    inputRef.current?.focus();

    // Build Gemini-format conversation history (exclude initial system greeting)
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));
    history.push({ role: 'user', parts: [{ text }] });

    const botId = Date.now() + 1;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!browserIsOnline()) {
      // Maestro is the one feature that genuinely cannot work without a network.
      // Saying so is better than letting the request hang and then fail with a
      // generic error, or pretending an answer is coming.
      setIsSearchingModels(false);
      setMessages((prev) => [
        ...prev,
        {
          id: botId,
          role: 'assistant',
          text: "You're offline, so I can't reach the AI service just yet. Your practice work is saved on this device — ask me again once you're back online.",
          time: timeStr,
        },
      ]);
      return;
    }

    if (!isAvailable()) {
      // Graceful fallback when no API key
      await new Promise((r) => setTimeout(r, 800));
      setIsSearchingModels(false);
      setMessages((prev) => [
        ...prev,
        { id: botId, role: 'assistant', text: 'Maestro needs an OpenRouter API key (VITE_OPENROUTER_API_KEY) to answer your questions. Please add it in the environment variables.', time: timeStr },
      ]);
      return;
    }

    try {
      const systemPrompt = buildSystemPrompt(context);
      const stream = streamGemini(history, systemPrompt, { temperature: 0.7, maxOutputTokens: 1024 });

      let accumulated = '';
      let firstChunk = true;

      setIsSearchingModels(false);
      setIsStreaming(true);

      for await (const chunk of stream) {
        if (firstChunk) {
          setIsSearchingModels(false);
          setMessages((prev) => [...prev, { id: botId, role: 'assistant', text: '', time: timeStr }]);
          firstChunk = false;
        }
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, text: accumulated } : m))
        );
      }

      if (firstChunk) {
        // stream produced nothing
        setIsSearchingModels(false);
        setMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Sorry, I didn\'t get a response. Please try again.', time: timeStr }]);
      }
    } catch (err) {
      setIsSearchingModels(false);
      const errText = err.message?.includes('429')
        ? 'Rate limit reached. Please wait a moment before sending another message.'
        : `Something went wrong: ${err.message}`;
      setMessages((prev) => [...prev, { id: botId, role: 'assistant', text: errText, time: timeStr }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages(initialMessage ? [{
      id: Date.now(),
      role: 'assistant',
      text: initialMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }] : INITIAL_MESSAGES);
  };

  // Quick action suggestions
  const quickActions = [
    { label: 'Explain step by step', icon: 'solar:list-check-linear' },
    { label: 'Give me a hint', icon: 'solar:lightbulb-linear' },
    { label: 'Check my answer', icon: 'solar:check-circle-linear' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Chat Panel */}
      <div 
        className={`
 fixed lg:absolute top-0 bottom-[60px] lg:bottom-0 right-0 z-50
 w-full sm:w-96 lg:w-[400px]
 bg-[#0a0f1a] border-l border-white/5
 flex flex-col
 transform transition-transform duration-300 ease-out
 ${isOpen ? 'translate-x-0' : 'translate-x-full'}
 `}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-gradient-to-r from-[#0a0f1a] to-[#111827] shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f99c00] to-amber-600 flex items-center justify-center">
                <HugeiconsIcon icon={AiLearningIcon} size={22} strokeWidth={2} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0f1a]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Maestro AI</h2>
              <p className={`text-xs flex items-center gap-1 ${isStreaming ? 'text-amber-400' : 'text-emerald-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isStreaming ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {isStreaming ? 'Thinking…' : 'Ready to help'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              title="New conversation"
            >
              <Icon icon="solar:restart-linear" width="18" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              title="Close chat"
            >
              <Icon icon="solar:close-circle-linear" width="20" />
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-thin">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isSearchingModels && <ModelSearchingIndicator />}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length <= 2 && !isStreaming && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.label)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-[#f99c00]/10 hover:border-[#f99c00]/30 text-xs text-slate-300 hover:text-[#f99c00] whitespace-nowrap transition-all shrink-0"
              >
                <Icon icon={action.icon} width="14" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 py-4 border-t border-white/5 bg-[#0a0f1a] shrink-0">
          <div className="flex items-end gap-2 bg-white/5 border border-white/10 hover:border-white/15 focus-within:border-[#f99c00]/40 focus-within:ring-2 focus-within:ring-[#f99c00]/10 rounded-xl px-4 py-3 transition-all">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Maestro anything..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none resize-none leading-relaxed py-0.5 min-h-[20px] max-h-[100px]"
              style={{ scrollbarWidth: 'none' }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={!inputValue.trim() || isStreaming}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                inputValue.trim() && !isStreaming
                  ? 'bg-[#f99c00] hover:bg-[#e88d00] text-[#0B1120] hover:scale-105 active:scale-95'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed'
              }`}
            >
              {isStreaming
                ? <span className="w-3 h-3 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />
                : <Icon icon="solar:arrow-up-linear" width="18" />
              }
            </button>
          </div>

          <p className="text-[10px] text-slate-600 text-center mt-2">
            {isStreaming ? 'Maestro is responding…' : 'Enter to send · Shift+Enter for new line'}
          </p>
        </div>
      </div>
    </>
  );
}
