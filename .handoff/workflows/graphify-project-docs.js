export const meta = {
  name: 'graphify-project-docs',
  description: 'Graphify semantic extraction for the new and revised project documents (analyses, READMEs, HUD pages), each chunk validated and fixed',
  phases: [
    { title: 'Sources', detail: 'two document chunks extracted in parallel, each validated and fixed' },
  ],
}

const ROOT = 'C:\\Users\\User\\projects\\galaxy'
const chunkPath = (n) => `${ROOT}\\graphify-out\\.graphify_chunk_${String(n).padStart(2, '0')}.json`

const CHUNKS = [
  { n: 10, files: [ROOT + '\\orgasm-brain\\research\\ANALYSIS.md', ROOT + '\\orgasm-brain\\README.md', ROOT + '\\orgasm-brain\\index.html', ROOT + '\\README.md'] },
  { n: 11, files: [ROOT + '\\orgasm-galaxy\\research\\ANALYSIS.md', ROOT + '\\orgasm-galaxy\\README.md', ROOT + '\\orgasm-galaxy\\index.html'] },
]

const stemOf = (f) => f.slice(ROOT.length + 1).replace(/\.[^.\\]+$/, '').split('\\').map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '_')).join('_')

const SPEC = (files, n, total) => `You are a graphify extraction subagent. Read the files listed and extract a knowledge graph fragment.
Output ONLY valid JSON matching the schema below - no explanation, no markdown fences, no preamble.

Files (chunk ${n} of ${total}):
${files.join('\n')}

Read every file in this list COMPLETELY before extracting anything from it. The Read tool
returns at most 2000 lines per call and reports NO error and NO warning when it truncates, so a
long file silently yields a partial extraction. When a file is longer than one call, keep paging
with offset/limit until you have actually seen its last line - never assume the first call
returned the whole file. Never emit nodes for a file you have only partly read. A partial
extraction is worse than none: replace-on-re-extract first DROPS that file's existing nodes and
then re-adds only what you saw, so the unread tail disappears from the graph, and the file is then
recorded as successfully extracted and never retried (#2225).

Report the coverage you actually achieved, so a short read is caught instead of guessed at: add a
top-level "coverage" object mapping each FILE_LIST path you extracted to the number of lines you
read, e.g. {"coverage": {"docs/plan.md": 452}}. If you could not reach a file's last line, still
report the count you did read. A short count is recoverable - Step B3 warns, the entry is cached
as partial, and the next --update retries the file - whereas a missing entry is indistinguishable
from a complete read.

Rules:
- EXTRACTED: relationship explicit in source (import, call, citation, "see §3.2")
- INFERRED: reasonable inference (shared data structure, implied dependency)
- AMBIGUOUS: uncertain - flag for review, do not omit

Code files: focus on semantic edges AST cannot find (call relationships, shared data, arch patterns).
  Do not re-extract imports - AST already has those.
Doc/paper files: extract named concepts, entities, citations. For rationale (WHY decisions were made, trade-offs, design intent): store as a \`rationale\` attribute on the relevant concept node — do NOT create a separate rationale node or fragment node. Only create a node for something that is itself a named entity or concept. Use \`file_type:"rationale"\` for concept-like nodes (ideas, principles, mechanisms, design patterns). \`file_type\` MUST be one of exactly these six values: \`code\`, \`document\`, \`paper\`, \`image\`, \`rationale\`, \`concept\`. Any other value is invalid and will be rejected.
Code files: when adding \`calls\` edges, source MUST be the caller (the function/class doing the calling), target MUST be the callee. Never reverse this direction. \`calls\` edges MUST stay within one language: a Python function cannot \`calls\` a JS/TS/Go/Rust/Java symbol and vice versa — cross-language call edges are phantom artifacts, never emit them.
Image files: use vision to understand what the image IS - do not just OCR.
  UI screenshot: layout patterns, design decisions, key elements, purpose.
  Chart: metric, trend/insight, data source.
  Tweet/post: claim as node, author, concepts mentioned.
  Diagram: components and connections.
  Research figure: what it demonstrates, method, result.
  Handwritten/whiteboard: ideas and arrows, mark uncertain readings AMBIGUOUS.

DEEP_MODE (if --mode deep was given): be aggressive with INFERRED edges - indirect deps,
  shared assumptions, latent couplings. Mark uncertain ones AMBIGUOUS instead of omitting.
DEEP_MODE for this chunk: false

Semantic similarity: if two concepts in this chunk solve the same problem or represent the same idea without any structural link (no import, no call, no citation), add a \`semantically_similar_to\` edge marked INFERRED with a confidence_score reflecting how similar they are (0.6-0.95). Examples:
- Two functions that both validate user input but never call each other
- A class in code and a concept in a paper that describe the same algorithm
- Two error types that handle the same failure mode differently
Only add these when the similarity is genuinely non-obvious and cross-cutting. Do not add them for trivially similar things.

Hyperedges: if 3 or more nodes clearly participate together in a shared concept, flow, or pattern that is not captured by pairwise edges alone, add a hyperedge to a top-level \`hyperedges\` array. Examples:
- All classes that implement a common protocol or interface
- All functions in an authentication flow (even if they don't all call each other)
- All concepts from a paper section that form one coherent idea
Use sparingly — only when the group relationship adds information beyond the pairwise edges. Maximum 3 hyperedges per chunk.

If a file has YAML frontmatter (--- ... ---), copy source_url, captured_at, author,
  contributor onto every node from that file.

confidence_score is REQUIRED on every edge - never omit it, never use 0.5 as a default:
- EXTRACTED edges: confidence_score = 1.0 always
- INFERRED edges: pick exactly ONE value from this set — never 0.5:
    0.95  direct structural evidence (shared data structure, named cross-file reference).
    0.85  strong inference (clear functional alignment, no direct symbol link).
    0.75  reasonable inference (shared problem domain + similar shape, requires interpretation).
    0.65  weak inference (thematically related, no shape evidence).
    0.55  speculative but plausible (surface-level co-occurrence only).
  Models follow discrete rubrics better than continuous ranges; the bimodal
  distribution observed in production (>50% at 0.5, >40% at 0.85+) shows the
  range guidance is being collapsed to a binary. If no value above fits, mark
  the edge AMBIGUOUS rather than picking 0.4 or below.
- AMBIGUOUS edges: 0.1-0.3

Node ID format: lowercase, only \`[a-z0-9_]\`, no dots or slashes. Format: \`{stem}_{entity}\` where stem is the **full repo-relative path with the extension dropped**, every path segment kept and joined with \`_\` (each segment lowercased with non-alphanumeric chars replaced by \`_\`), and entity is the symbol name similarly normalized. Use every directory level, not just the immediate parent — this keeps same-named files in different directories distinct. Examples: \`src/auth/session.py\` + \`ValidateToken\` → \`src_auth_session_validatetoken\`; \`lib/utils/helpers.py\` + \`parse_url\` → \`lib_utils_helpers_parse_url\`; \`tests/test_foo.py\` + \`_helper\` → \`tests_test_foo_helper\`; \`docs/v1/api/README.md\` + \`getUser\` → \`docs_v1_api_readme_getuser\`. Top-level files (no parent dir, e.g. \`setup.py\`) use just the filename stem: \`setup_my_func\`. This must match the ID the AST extractor generates — using just the filename (e.g., \`session_validatetoken\`) or only the immediate parent (e.g., \`auth_session_validatetoken\`) will create orphan ghost-duplicate nodes. If you are re-extracting a project built under the old immediate-parent format, the user should run \`graphify extract --force\` to rebuild cleanly. CRITICAL: never append chunk numbers, sequence numbers, or any suffix to an ID (no \`_c1\`, \`_c2\`, \`_chunk2\`, etc.). IDs must be deterministic from the label alone — the same entity must always produce the same ID regardless of which chunk processes it.

Generate the extraction JSON matching this schema exactly:
{"nodes":[{"id":"auth_session_validatetoken","label":"Human Readable Name","file_type":"code|document|paper|image|rationale|concept","source_file":"<FILE_LIST path verbatim>","source_location":null,"source_url":null,"captured_at":null,"author":null,"contributor":null}],"edges":[{"source":"node_id","target":"node_id","relation":"calls|implements|references|cites|conceptually_related_to|shares_data_with|semantically_similar_to|rationale_for","confidence":"EXTRACTED|INFERRED|AMBIGUOUS","confidence_score":1.0,"source_file":"<FILE_LIST path verbatim>","source_location":null,"weight":1.0}],"hyperedges":[{"id":"snake_case_id","label":"Human Readable Label","nodes":["node_id1","node_id2","node_id3"],"relation":"participate_in|implement|form","confidence":"EXTRACTED|INFERRED","confidence_score":0.75,"source_file":"<FILE_LIST path verbatim>"}],"input_tokens":0,"output_tokens":0,"coverage":{"<FILE_LIST path verbatim>":0}}

source_file RULE (every node, edge, and hyperedge): set source_file to the path of the originating file EXACTLY as it appears in FILE_LIST — verbatim and absolute. Do NOT shorten to a basename, do NOT re-relativize, do NOT strip any directory prefix, and do NOT change separators (the engine canonicalizes separators and relativizes against the build root downstream). Copy the FILE_LIST entry character-for-character. This keeps the full build and incremental --update on the same base, so build_merge's replace-on-re-extract matches the existing node instead of accumulating a duplicate.

Then write the JSON to disk using the Write tool at this exact absolute path (no relative paths — Write resolves relative paths against an undefined cwd and the file will be silently lost):
${chunkPath(n)}`

const stemNote = (files) => `---
Additional context for this chunk: the build root is ${ROOT}. The stems for this chunk's files are:
${files.map((f) => `- ${f} -> ${stemOf(f)}_<entity>`).join('\n')}
All node labels must be in English.`

const KEYS = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    fixes: { type: 'array', items: { type: 'string' } },
    nodeCount: { type: 'integer' },
    edgeCount: { type: 'integer' },
    keyNodes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } }, required: ['id', 'label'] } },
  },
  required: ['ok', 'fixes', 'nodeCount', 'edgeCount', 'keyNodes'],
}

const verifyPrompt = (c, externalIds) => `You are validating a graphify extraction chunk before it is merged into the knowledge graph. Chunk file: ${chunkPath(c.n)}
Its FILE_LIST was:
${c.files.join('\n')}

Load the JSON with Python (python -I -c ... ; read with encoding='utf-8') and check every rule below. Fix every violation IN PLACE in the chunk file (rewrite it with json.dump, ensure_ascii=False, indent=2), keeping all valid content:
1. The file exists and is valid JSON with top-level nodes, edges, hyperedges, input_tokens, output_tokens, coverage. If the file is missing, report ok=false and stop.
2. Every node has id, label, file_type, source_file. file_type is one of code, document, paper, image, rationale, concept.
3. Every id matches ^[a-z0-9_]+$, has no chunk/sequence suffix, and starts with the stem of its source_file:
${c.files.map((f) => `   ${f} -> ${stemOf(f)}_`).join('\n')}
   Rename wrong ids (and every edge/hyperedge reference to them) to the correct stem + entity.
4. source_file on every node, edge and hyperedge is one of the FILE_LIST paths verbatim.
5. Every edge source/target and every hyperedge member is a node id in this chunk${externalIds ? ' or one of the existing external ids listed below' : ''}. Repair a dangling reference when the intended node is obvious (typo, wrong prefix); otherwise drop that edge.
6. confidence rubric: EXTRACTED → confidence_score 1.0; INFERRED → one of 0.95, 0.85, 0.75, 0.65, 0.55; AMBIGUOUS → 0.1–0.3. Fix out-of-rubric scores to the nearest allowed value. No duplicate edges (same source, target, relation).
7. coverage: for each FILE_LIST path, compare the reported number with the real line count (count lines in Python). If a reported count is lower than the real count, say so in fixes (do not invent extraction).
8. All labels are English.
9. At most 3 hyperedges.
Then return: ok (true when the chunk is mergeable), fixes (one line per change or problem), nodeCount, edgeCount, and keyNodes = the 45 most connected concept/document nodes in the chunk (id + label), most connected first.
${externalIds ? `\nExisting external ids that edges may legitimately point to:\n${externalIds}` : ''}`

const extractAndVerify = async (c, phaseName, extra, externalIds) => {
  const text = await agent(SPEC(c.files, c.n, 11) + '\n\n' + stemNote(c.files) + (extra ? '\n\n' + extra : ''), { label: `extract:chunk${c.n}`, phase: phaseName, agentType: 'general-purpose' })
  const v = await agent(verifyPrompt(c, externalIds), { label: `validate:chunk${c.n}`, phase: phaseName, schema: KEYS })
  return { chunk: c.n, extractorSaid: typeof text === 'string' ? text.slice(0, 400) : null, verdict: v }
}

// The three chunks are independent: each goes straight from extraction to validation.
phase('Sources')
const results = await pipeline(CHUNKS, (c) => extractAndVerify(c, 'Sources'))
log(`chunks: ${results.map((r) => r && r.verdict ? `#${r.chunk} ${r.verdict.nodeCount} nodes/${r.verdict.edgeCount} edges` : 'failed').join(', ')}`)
return { chunks: results }
