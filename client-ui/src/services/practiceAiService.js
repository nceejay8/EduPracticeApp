// AI grading of a student's worked answer, via the ai-proxy Edge Function.
//
// This used to call OpenRouter directly with VITE_OPENROUTER_API_KEY, so setting
// that variable published the key to every visitor. The key now lives in the
// proxy and this file sends a signed-in session instead.

import { checkAndRecord, blockedMessage } from '../utils/rateLimiter';
import { complete, isAvailable } from './aiProxy';

export { isAvailable };

// Asked for as a schema rather than "return JSON and hope". The proxy passes
// this through to Gemini's structured-output mode, so the response is already
// shaped; the parse below is belt-and-braces for the case where a model ignores
// the schema rather than a schema-less model wrapping its answer in fences.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    score:       { type: 'number' },
    summary:     { type: 'string' },
    strengths:   { type: 'array', items: { type: 'string' } },
    improvements:{ type: 'array', items: { type: 'string' } },
    modelAnswer: { type: 'string' },
  },
  required: ['score', 'summary', 'strengths', 'improvements', 'modelAnswer'],
};

function parseGradingResponse(text) {
  if (!text) throw new Error('Empty AI response.');

  try {
    return JSON.parse(text);
  } catch {
    // The schema should make this unreachable, but a refusal or a truncated
    // response is not a reason to fail the student's whole attempt.
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    const object = text.match(/\{[\s\S]*\}/);
    if (object?.[0]) return JSON.parse(object[0]);
    throw new Error('Could not parse AI evaluation response.');
  }
}

export async function evaluatePracticeSolution({
  subject,
  level,
  topic,
  question,
  studentAnswer,
  attachmentName = null,
}) {
  // Courtesy limit only. It stops a double-submit from burning the user's
  // allowance, but it is per-device and self-documented in utils/rateLimiter.js
  // as a good-faith barrier. The one that counts is per-user server side in the
  // proxy, which cannot be cleared from the console.
  const rl = checkAndRecord('aiEval');
  if (rl.blocked) {
    throw new Error(blockedMessage('aiEval', rl.retryAfterMs));
  }

  const prompt = [
    'You are a strict but supportive A-Level exam grader.',
    'Evaluate the student answer against the question. Award marks only where the',
    'work shown justifies them, following the mark scheme.',
    '',
    `Subject: ${subject}`,
    `Level: ${level}`,
    `Topic: ${topic}`,
    '',
    'Question:',
    question,
    '',
    attachmentName ? `Attached file name: ${attachmentName}` : 'Attached file name: none',
    '',
    'Student answer:',
    studentAnswer,
  ].join('\n');

  const text = await complete({
    route: 'grade',
    systemInstruction:
      'Grade exam answers. Return only the structured object; no prose, no markdown.',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    responseSchema: RESPONSE_SCHEMA,
  });

  const parsed = parseGradingResponse(text);

  return {
    // Clamped rather than trusted: a score above 100 or below 0 would corrupt
    // the per-topic accuracy the syllabus page reports.
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    summary: parsed.summary || 'Evaluation completed.',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    modelAnswer: parsed.modelAnswer || '',
  };
}
