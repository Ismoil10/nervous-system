// Counts graphify usage versus direct reads in workflow agent transcripts.
// Usage: node graph_usage.js <workflow transcript dir>...
const fs = require('fs');
const path = require('path');
for (const dir of process.argv.slice(2)) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'));
  const rows = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean);
    const r = { label: '?', q: 0, ex: 0, pa: 0, readRaw: 0, readSrc: 0, readDoc: 0, grep: 0, firstQ: null, firstSrc: null, tools: 0 };
    for (const line of lines) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      const c = o.message && o.message.content;
      if (r.label === '?' && o.type === 'user') {
        const t = typeof c === 'string' ? c : JSON.stringify(c || '');
        const m = t.match(/(Your research lens: [\w-]+|Fact-check lens: [\w-]+|reported the issue|You are the editor|You are the architect|You write section \d+)/);
        if (m) r.label = m[1];
      }
      if (!Array.isArray(c)) continue;
      for (const b of c) {
        if (b.type !== 'tool_use') continue;
        r.tools++;
        const s = JSON.stringify(b.input);
        if (/graphify query/.test(s)) { r.q++; if (r.firstQ === null) r.firstQ = r.tools; }
        if (/graphify explain/.test(s)) r.ex++;
        if (/graphify path/.test(s)) r.pa++;
        if (b.name === 'Read' && /raw/.test(s)) r.readRaw++;
        if (b.name === 'Read' && /src\\\\|src\//.test(s)) { r.readSrc++; if (r.firstSrc === null) r.firstSrc = r.tools; }
        if (b.name === 'Read' && /research/.test(s)) r.readDoc++;
        if (b.name === 'Grep' || /\bgrep\b|\brg\b/.test(s)) r.grep++;
      }
    }
    rows.push(r);
  }
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  console.log(`== ${path.basename(dir)}: ${rows.length} agents; graphify query ${sum('q')}, explain ${sum('ex')}, path ${sum('pa')}; Read raw ${sum('readRaw')}, Read src ${sum('readSrc')}, Read research docs ${sum('readDoc')}, grep ${sum('grep')}; tool calls ${sum('tools')}`);
  console.log(`   agents with no graph call: ${rows.filter((r) => r.q + r.ex + r.pa === 0).map((r) => r.label).join(', ') || 'none'}`);
  console.log(`   agents that read src before their first query: ${rows.filter((r) => r.firstSrc !== null && (r.firstQ === null || r.firstSrc < r.firstQ)).map((r) => r.label).join(', ') || 'none'}`);
  const byLabel = {};
  for (const r of rows) {
    const k = r.label.replace(/ \d+$/, '').replace(/: [\w-]+$/, '');
    const g = byLabel[k] || (byLabel[k] = { n: 0, q: 0, ex: 0, pa: 0, raw: 0, src: 0, noGraph: 0 });
    g.n++; g.q += r.q; g.ex += r.ex; g.pa += r.pa; g.raw += r.readRaw; g.src += r.readSrc; if (r.q + r.ex + r.pa === 0) g.noGraph++;
  }
  for (const [k, g] of Object.entries(byLabel)) console.log(`   ${k}: ${g.n} agents, query ${g.q}, explain ${g.ex}, path ${g.pa}, raw reads ${g.raw}, src reads ${g.src}, no graph call ${g.noGraph}`);
}
