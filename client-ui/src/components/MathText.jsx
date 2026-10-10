import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { splitMath } from '../lib/mathSplit';

// Renders a string that may contain LaTeX between $...$ / $$...$$ / \(...\) /
// \[...\]. Plain text is passed through untouched; math is typeset with KaTeX.
//
// The component returns inline content rather than a block wrapper, so it can
// drop into an existing <p>, <span> or <li> without changing the surrounding
// layout. Display math is emitted as a block-level <span> (still valid phrasing
// content), which centres it on its own line.
function renderMath(value, display) {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
    });
  } catch {
    return null;
  }
}

export default function MathText({ text, className = '' }) {
  const tokens = useMemo(() => splitMath(text), [text]);

  return (
    <span className={`whitespace-pre-line ${className}`}>
      {tokens.map((token, i) => {
        if (token.type === 'text') {
          return <React.Fragment key={i}>{token.value}</React.Fragment>;
        }

        const display = token.type === 'display';
        const html = renderMath(token.value, display);

        // A malformed expression must not vanish silently; fall back to showing
        // the author's raw source so the mistake is visible and fixable.
        if (!html) {
          return <React.Fragment key={i}>{display ? `$$${token.value}$$` : `$${token.value}$`}</React.Fragment>;
        }

        return (
          <span
            key={i}
            className={display ? 'block my-3 text-center overflow-x-auto' : 'inline-block align-middle'}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
