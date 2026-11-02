// Assembles brain-system/research/ANALYSIS.md from the brain-system-research workflow output.
// Order: §1–§13, §14 (sources, written by the §1 writer), Appendix A (framework), Appendix B (implementation plan).
// Usage: node assemble_analysis.js <workflow output file> <target .md>
const fs = require('fs');
const [, , src, out] = process.argv;
const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
const r = raw.result || raw;
const all = r.sections.filter((s) => s && typeof s.text === 'string');
const num = all.filter((s) => typeof s.n === 'number').sort((a, b) => a.n - b.n);
const appB = all.find((s) => s.n === 'B');
const problems = [];
for (let n = 1; n <= 13; n++) if (!num.find((s) => s.n === n)) problems.push(`missing §${n}`);
if (!appB) problems.push('missing Appendix B');

// Drop fences and any preamble before the first "## " heading.
const clean = (t, label) => {
  t = t.replace(/^\s*```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '');
  const i = t.search(/^## /m);
  if (i > 0) { problems.push(`${label}: dropped ${i} chars of preamble`); t = t.slice(i); }
  if (i < 0) problems.push(`${label}: no "## " heading`);
  return t.trim();
};

let sources = '';
const parts = num.map((s) => {
  let t = clean(s.text, `§${s.n}`);
  if (s.n === 1) {
    const m = t.search(/^## 14\./m);
    if (m >= 0) { sources = t.slice(m).trim(); t = t.slice(0, m).trim(); } else problems.push('§14 not found in the §1 text');
  }
  const h = t.match(/^## (\d+)\./);
  if (!h || Number(h[1]) !== s.n) problems.push(`§${s.n}: heading reads "${t.split('\n')[0].slice(0, 60)}"`);
  return t;
});

const head = `# Brain System — the brain, its internal systems and its networks throughout the body: analysis and design rationale

Status: specification for extending Brain System from a brain-only dopamine visualization to the brain's
networks throughout a star-built human body (somatic, autonomic, enteric, neuroendocrine and neuroimmune),
with every sensory input, a master switch (brain only ↔ whole body) and one switch per network. Written
before that code. The dopamine-during-orgasm model is one scenario; its specification is
[DOPAMINE.md](DOPAMINE.md). Assembled from section drafts written in parallel against one framework
contract (Appendix A); fact-checked after assembly. Date: 2026-10-31.

---
`;
const framework = String(r.framework || '').trim()
  .replace(/^# [^\n]*\n+/, '')
  .replace(/^## (A\.\d+)/gm, '### $1')
  .replace(/^### (A\.\d+\.\d+)/gm, '#### $1');
const blocks = [...parts];
if (sources) blocks.push(sources);
blocks.push(`## Appendix A. Framework contract\n\n${framework}`);
if (appB) blocks.push(clean(appB.text, 'Appendix B'));
const text = head + '\n' + blocks.join('\n\n---\n\n') + '\n';
fs.writeFileSync(out, text, 'utf8');
console.log(JSON.stringify({ sizes: all.map((s) => [s.n, s.text.length]), problems, bytes: Buffer.byteLength(text), lines: text.split('\n').length }, null, 1));
