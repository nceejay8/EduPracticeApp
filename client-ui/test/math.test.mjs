// Tests for the math tokenizer that decides which parts of authored question
// text are LaTeX and which are prose.
//
//   npm test
//
// The single-dollar guard is the part worth pinning: exam prose can contain a
// currency amount, and treating "$5 and $10" as the formula "5 and " would
// replace a sentence with a broken equation in front of a student.

import { splitMath, hasMath } from '../src/lib/mathSplit.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) { fails++; console.log(`FAIL  ${label} ${extra}`); }
  else console.log(`ok    ${label} ${extra}`);
};

const types = (s) => splitMath(s).map((t) => t.type);

// ── Plain text is untouched ─────────────────────────────────────────────────
check('plain text is one text token', JSON.stringify(splitMath('Find the velocity.')) === JSON.stringify([{ type: 'text', value: 'Find the velocity.' }]));
check('empty string has no tokens', splitMath('').length === 0);
check('null becomes empty', splitMath(null).length === 0);
check('no math detected in prose', hasMath('A body of mass 2 kg moves at 4 m/s.') === false);

// ── Inline math ─────────────────────────────────────────────────────────────
check('single dollar is inline', types('a $x^2$ b').join(',') === 'text,inline,text');
check('inline value captured', splitMath('$x^2$')[0].value === 'x^2');
check('backslash-paren is inline', types('a \\(x\\) b').join(',') === 'text,inline,text');

// ── Display math ────────────────────────────────────────────────────────────
check('double dollar is display', types('$$x^2$$').join(',') === 'display');
check('backslash-bracket is display', types('\\[x^2\\]').join(',') === 'display');
check('display value captured', splitMath('before $$\\frac{a}{b}$$ after')[1].value === '\\frac{a}{b}');

// ── Guards against non-math dollars ─────────────────────────────────────────
check('currency pair stays prose', types('$5 and $10').join(',') === 'text',
  JSON.stringify(splitMath('$5 and $10')));
check('lone dollar stays prose', types('costs $5').join(',') === 'text');
check('unclosed math stays prose', types('$x + 1').join(',') === 'text');
check('whitespace-padded dollars stay prose', types('$ 5 $').join(',') === 'text');
check('inline math cannot span lines', types('$x\n+y$').join(',') === 'text');

// ── Mixing ──────────────────────────────────────────────────────────────────
const mixed = splitMath('Mass $m = 2\\,\\mathrm{kg}$ falls $$v = gt$$ then stops.');
check('mixed text/math count', mixed.length === 5, `(got ${mixed.length})`);
check('mixed types', JSON.stringify(mixed.map((t) => t.type)) === JSON.stringify(['text', 'inline', 'text', 'display', 'text']));
check('mixed detects math', hasMath('Mass $m = 2\\,\\mathrm{kg}$') === true);

console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
