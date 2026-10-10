// ai-proxy — the only thing in this project that talks to Gemini.
//
// The key lives here as a Supabase Edge Function secret, never as a VITE_ var.
// Vite inlines VITE_* into the client bundle, so a Gemini key in .env.local is a
// public key within minutes of deploying. That is not hypothetical: it is why
// this function exists.
//
// Two callers, two auth paths:
//
//   grade / chat  — a signed-in student. Bearer JWT, verified against Supabase
//                   Auth, then rate limited per user id.
//   generate      — the daily generator in .github/workflows. Authenticated by
//                   a shared GENERATOR_SECRET header, not a user JWT, because CI
//                   has no user to sign in as.
//
// The generator deliberately does NOT get the Gemini key. One holder means one
// rotation point and one thing to audit; a second copy in a CI secret would undo
// that.
//
// Generation *policy* — which topics, how many, validation, the 10-per-topic cap
// — lives in client-ui/scripts/generate-questions.mjs, where it can be unit
// tested. This function only holds credentials and enforces access.

import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Flash-Lite grades and answers chat; its free tier allows 30 RPM against Flash's
// 15, and concurrent students are the bottleneck, not generation quality. Both
// are GA — no preview models on a student-facing path. Overridable so a paid
// project can move to Flash without a code change.
const CHAT_MODEL = Deno.env.get('GEMINI_CHAT_MODEL') ?? 'gemini-2.5-flash-lite';
const GEN_MODEL = Deno.env.get('GEMINI_GEN_MODEL') ?? 'gemini-2.5-flash';

// Per-user limits. The client also limits itself (utils/rateLimiter.js) but that
// is a per-device good-faith barrier anyone can clear, so it is UX polish, not
// the boundary. This is a burst shaver: Edge Function instances are ephemeral and
// there is more than one, so a determined caller can exceed this. The hard
// ceiling is Gemini's own 1,500 requests/day free-tier cap, which no amount of
// client behaviour can get past.
const LIMITS = {
  grade: { windowMs: 10 * 60 * 1000, max: 6 },
  chat:  { windowMs: 5 * 60 * 1000,  max: 12 },
};
const buckets = new Map();

function rateLimit(key, limit) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter(t => now - t < limit.windowMs);
  if (hits.length >= limit.max) {
    const retryAfterMs = limit.windowMs - (now - hits[0]);
    return { allowed: false, retryAfterMs };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true };
}

// Keep the map from growing without bound on a long-lived instance.
if (Deno.env.get('DENO_DEPLOYMENT_ID') === undefined) {
  setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, v] of buckets) {
      const kept = v.filter(t => t > cutoff);
      if (kept.length) buckets.set(k, kept); else buckets.delete(k);
    }
  }, 10 * 60 * 1000).unref?.();
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-generator-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// Verifies the caller's Supabase session. Returns the user, or a Response to
// return verbatim.
async function requireUser(req) {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return { error: json({ error: 'Not signed in.' }, 401) };

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { data, error } = await createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  }).auth.getUser(token);

  if (error || !data?.user) return { error: json({ error: 'Session expired. Please sign in again.' }, 401) };
  return { user: data.user };
}

async function isAdmin(userId) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { data } = await createClient(url, key)
    .from('content_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

// One call to Gemini. `bodies` lets a request ask for the streaming variant
// without duplicating the URL construction and error handling.
async function gemini(model, payload, apiKey) {
  const stream = payload.stream === true;
  delete payload.stream;

  const res = await fetch(
    `${GEMINI_BASE}/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    let message = detail;
    try { message = JSON.parse(detail)?.error?.message ?? detail; } catch { /* raw body */ }

    if (res.status === 429) {
      return { error: json({ error: 'The AI service is busy. Please try again shortly.', retryable: true }, 429) };
    }
    if (res.status === 400 && /API key not valid/i.test(message)) {
      return { error: json({ error: 'The server AI key is invalid. Check the GEMINI_API_KEY secret.' }, 500) };
    }
    if (res.status === 404) {
      return { error: json({ error: `Unknown model "${model}". Check the model env vars.` }, 500) };
    }
    console.error('gemini error', res.status, message);
    return { error: json({ error: 'The AI service returned an error.' }, 502) };
  }

  return { res, stream };
}

// Pulls text out of a non-streaming generateContent response.
function readText(data) {
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (req.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY is not set as an Edge Function secret.' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const route = body?.route;
  if (!route) return json({ error: 'Missing "route".' }, 400);

  // ── generate ───────────────────────────────────────────────────────────────
  // CI-to-CI. Authenticated by shared secret; the generator is not a user and has
  // no session. Deliberately dumb: it forwards a payload the generator already
  // validated, so there is no second copy of the generation rules to keep in
  // sync.
  if (route === 'generate') {
    const expected = Deno.env.get('GENERATOR_SECRET');
    if (!expected) {
      return json({ error: 'GENERATOR_SECRET is not set as an Edge Function secret.' }, 500);
    }
    // Constant-time-ish compare. Length is not secret, so compare first to avoid
    // leaking anything through an early return.
    const provided = req.headers.get('x-generator-secret') ?? '';
    if (provided.length !== expected.length || provided !== expected) {
      console.warn('ai-proxy: rejected generate call with bad generator secret');
      return json({ error: 'Not authorised to run generation.' }, 403);
    }

    const result = await gemini(
      body.model ?? GEN_MODEL,
      {
        contents: body.contents,
        systemInstruction: body.systemInstruction,
        generationConfig: {
          ...body.generationConfig,
          // Structured output. Far more reliable than asking for JSON and
          // stripping code fences client-side, which is what the old
          // practiceAiService extractJson() had to do. Gemini only accepts
          // `responseSchema` inside `generationConfig`; the generator sends it
          // top-level, so it is folded in here.
          ...(body.responseSchema ? { responseSchema: body.responseSchema } : {}),
        },
      },
      apiKey,
    );
    if (result.error) return result.error;

    const data = await result.res.json();
    return json({ text: readText(data), usage: data?.usageMetadata ?? null });
  }

  // ── grade / chat ───────────────────────────────────────────────────────────
  // Everything below is a signed-in student.
  const { user, error } = await requireUser(req);
  if (error) return error;

  if (route === 'chat' || route === 'grade') {
    const limit = LIMITS[route];
    const verdict = rateLimit(`${user.id}:${route}`, limit);
    if (!verdict.allowed) {
      const seconds = Math.ceil(verdict.retryAfterMs / 1000);
      return json(
        { error: `You are going quickly. Try again in ${Math.ceil(seconds / 60)} minute(s).`, retryable: true },
        429,
        { 'Retry-After': String(seconds) },
      );
    }
  }

  if (route === 'grade') {
    const result = await gemini(
      CHAT_MODEL,
      {
        contents: body.contents,
        systemInstruction: body.systemInstruction,
        generationConfig: {
          temperature: body.temperature ?? 0.2,
          maxOutputTokens: body.maxOutputTokens ?? 700,
          // Grading a worked answer is a short, well-specified task. Letting the
          // model think first spends free-tier tokens and adds seconds of
          // latency to a student waiting on their feedback.
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          ...(body.responseSchema ? { responseSchema: body.responseSchema } : {}),
        },
      },
      apiKey,
    );
    if (result.error) return result.error;
    const data = await result.res.json();
    return json({ text: readText(data), usage: data?.usageMetadata ?? null });
  }

  if (route === 'chat') {
    const result = await gemini(
      CHAT_MODEL,
      {
        contents: body.contents,
        systemInstruction: body.systemInstruction,
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: body.maxOutputTokens ?? 1024,
        },
        // Streaming is opt-in, so a caller that forgets the flag gets the
        // simple one-shot answer instead of an SSE body it cannot parse.
        ...(body.stream === true ? { stream: true } : {}),
      },
      apiKey,
    );
    if (result.error) return result.error;

    // Pass the SSE stream straight through. Re-chunking it here would add
    // latency to a chat that is supposed to feel live.
    if (result.stream) {
      return new Response(result.res.body, {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
      });
    }

    const data = await result.res.json();
    return json({ text: readText(data), usage: data?.usageMetadata ?? null });
  }

  return json({ error: `Unknown route "${route}".` }, 400);
});
