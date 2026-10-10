// Splits authored text into plain-text and math segments so the UI can typeset
// the math with KaTeX and leave the prose alone.
//
// Supported delimiters, in the order they are checked:
//   $$ ... $$   display math
//   \[ ... \]   display math
//   \( ... \)   inline math
//   $ ... $     inline math
//
// The single-dollar form is deliberately guarded. Exam prose occasionally
// contains a currency amount, and "$5 and $10" must stay a sentence rather than
// becoming the formula "5 and ". A single-dollar pair only counts as math when
// the content is non-empty, does not span a line break, and has no leading or
// trailing whitespace — which is exactly what "$5 and $" is not.
//
// This module has no dependencies so it can be unit tested under plain Node
// (see test/math.test.mjs) without pulling in KaTeX or React.

export function splitMath(input) {
  const text = input == null ? '' : String(input);
  const tokens = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      tokens.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        flush();
        tokens.push({ type: 'display', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        flush();
        tokens.push({ type: 'display', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text.startsWith('\\(', i)) {
      const end = text.indexOf('\\)', i + 2);
      if (end !== -1) {
        flush();
        tokens.push({ type: 'inline', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        const value = text.slice(i + 1, end);
        if (value.length > 0 && value === value.trim() && !value.includes('\n')) {
          flush();
          tokens.push({ type: 'inline', value });
          i = end + 1;
          continue;
        }
      }
    }

    buffer += text[i];
    i += 1;
  }

  flush();
  return tokens;
}

// True when the text actually contains a math segment, so callers can skip the
// KaTeX render path entirely for the common case of plain questions.
export function hasMath(input) {
  return splitMath(input).some((t) => t.type !== 'text');
}
