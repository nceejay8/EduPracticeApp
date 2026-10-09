// Client for the ai-proxy Edge Function.
//
// Nothing here holds a credential. The anon key is public by design and is
// gated by Row Level Security; the Gemini key never leaves the function. The
// old arrangement had `VITE_OPENROUTER_API_KEY` read directly by two services,
// which meant anyone who opened the deployed page source could read it and
// spend the account's quota.

import { supabase } from '../lib/supabaseClient';

const EDGE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`;

// Rejection reasons the proxy returns that the UI should show verbatim, because
// they are the user telling us something broke rather than the model failing.
const FRIENDLY = {
  401: 'Your session has expired. Please sign in again.',
  429: 'The AI service is busy right now. Please try again shortly.',
};

async function authHeaders() {
  const { data } = await supabase?.auth.getSession() ?? { data: {} };
  return {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    // The function verifies this with Supabase Auth, so an absent or stale token
    // fails closed rather than falling through to an unauthenticated request.
    'Authorization': `Bearer ${data?.session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

// The proxy is reachable whenever Supabase is configured. There is no key to be
// missing on the client any more, which is the point.
export function isAvailable() {
  return Boolean(supabase);
}

async function post(body, { signal } = {}) {
  const res = await fetch(EDGE_FN, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = {};
    try { detail = await res.json(); } catch { /* non-JSON error body */ }
    const message = detail.error || FRIENDLY[res.status];
    const error = new Error(message || `Request failed (${res.status}).`);
    error.status = res.status;
    error.retryable = Boolean(detail.retryable);
    throw error;
  }
  return res;
}

// One-shot completion. Returns the text.
export async function complete(body) {
  const res = await post(body);
  const data = await res.json();
  return data.text ?? '';
}

// Streaming completion, for chat. Yields text chunks as they arrive.
//
// Gemini's SSE frames are `data: {...}`; the text lives at
// candidates[0].content.parts[0].text. A `[DONE]` sentinel ends the stream, and
// Gemini also just closes the connection, so both are handled.
export async function* stream(body) {
  const res = await post({ ...body, route: 'chat', stream: true });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are newline-delimited, so a chunk can split one in half. Keep the
      // remainder in the buffer rather than parsing a partial line.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const text = parsed?.candidates?.[0]?.content?.parts
            ?.map(p => p.text ?? '').join('') ?? '';
          if (text) yield text;
        } catch {
          // A single malformed frame is not worth killing the stream over; the
          // next one usually parses fine.
        }
      }
    }
  } finally {
    // Releasing lets the connection close if the consumer stopped early, which
    // it does whenever the user stops generating a message.
    reader.releaseLock();
  }
}
