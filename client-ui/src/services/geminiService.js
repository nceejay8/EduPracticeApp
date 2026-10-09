// Maestro chat and audio overviews, via the ai-proxy Edge Function.
//
// The name is historical. This used to build OpenAI-shaped messages and call
// OpenRouter with a key read from VITE_OPENROUTER_API_KEY, which put that key in
// the shipped bundle. It now forwards Gemini-shaped `contents` to the proxy
// untouched — the API was already Gemini-shaped, so the translation layer was
// pure liability.
//
// The signature is unchanged, so callers in ChatInterface.jsx and
// AudioOverview.jsx did not have to move.

import { isAvailable, complete, stream } from './aiProxy';

export { isAvailable, callGemini, streamGemini };

// `contents` is Gemini-native: [{ role: 'user' | 'model', parts: [...] }].
async function callGemini(contents, systemInstruction = null, opts = {}) {
  try {
    return await complete({
      route: 'chat',
      // The proxy streams chat by default only when asked; this caller wants
      // the whole answer as one JSON payload (audio scripts, summaries), so it
      // says so rather than receiving an SSE body it cannot parse.
      stream: false,
      contents,
      systemInstruction,
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    });
  } catch (error) {
    throw new Error(`Failed to reach the AI service: ${error.message}`);
  }
}

// Yields text chunks as they arrive. The proxy already rate limits this route
// per user; the client-side limiter in utils/rateLimiter.js is a courtesy that
// stops the user burning their own allowance on a double-click.
async function* streamGemini(contents, systemInstruction = null, opts = {}) {
  yield* stream({
    contents,
    systemInstruction,
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
  });
}
