# VisualizeOurCode

A zero-cost, client-side **LeetCode / DSA Visualizer** built with Next.js, React, Tailwind CSS, and Framer Motion.

## Features

- **Instant client-side tracing** — instrument JS/TS code, execute it, visualize in under 100ms
- **6 Visualization Modes**: Array, Result Array, Hash Map, Linked List, Tree/Graph, Grid
- **Template merging** — real execution values merged with human-readable explanation templates
- **Step slider** — scrub through trace history with live variable watch panel
- **Built-in demos** — Two Sum, Reverse Linked List, Combination Sum (zero latency)
- **Optional AI templates** — Gemini generates explanation text only (cached), not full timelines

## Architecture

```
Code → instrumentCode() → runSandbox() → traceHistory[]
                                              ↓
                        static/AI templates → mergeStepsWithAI() → TimelineFrame[]
                                              ↓
                                    Slider + VisualizationCanvas
```

`instrumentCode()` discovers the bindings a snippet actually declares — parameters,
`const`/`let`/`var`, destructured names, `for...of` heads — and records a snapshot at
each point that changes state: assignments, indexed writes, `++`/`--`, and mutating
method calls like `res.push(...)` or `seen.set(...)`.

### Execution budgets

Three independent budgets bound every run, enforced in `runSandbox()`:

| Budget | Default | Stops |
|---|---|---|
| `maxSteps` | 500 | Runaway trace growth |
| `maxLoopIterations` | 1,000,000 | Loops that record no steps |
| `timeoutMs` | 1000 | Everything else |

The step budget alone can't stop `while (true) {}` — a loop whose body records
nothing never calls `__trace__`. So `instrumentCode()` rewrites loop *conditions*
to call a guard first (`while (__guard__() && (cond))`), which also covers
brace-less bodies and the tail of a `do/while`.

## Testing

```bash
npm test        # vitest, 42 tests over the engine
npm run typecheck
```

CI runs typecheck → test → build on every push and pull request.

## Known limits

- **Instrumentation is regex-based, not an AST walk.** A statement split across
  several lines is only seen at its first line, and a brace-less header with its
  body on the *same* line (`if (x) return -1;`) is not traced.
- **`new Function()` is an execution wrapper, not a security boundary.** Traced
  code runs on the page with the same access as the rest of the app. That is
  acceptable here because you are running your own code in your own browser, and
  nothing is ever executed server-side — but it is not a sandbox in the isolation
  sense, and untrusted third-party code should not be pasted in.
- **Unbounded recursion** is not covered by the budgets above; it terminates via
  the engine's own stack overflow and surfaces as a normal execution error.
- Non-JS languages (Python, Java, C++) are matched to **pattern tracers**; only
  JavaScript/TypeScript is genuinely executed.

## Getting Started

```bash
npm install
npm run dev
```

If you see `Cannot find module './331.js'` or `a[d] is not a function`, the dev cache is stale. Run:

```bash
npm run dev:clean
```

Open [http://localhost:3000](http://localhost:3000). No API key required for the default flow.

### Optional: AI explanation templates

```bash
cp .env.example .env.local
# Add GEMINI_API_KEY=your_key_here
```

Click **AI Templates** to fetch cached explanation templates from Gemini (~4KB JSON, not full timelines).

## Usage

1. Paste DSA code in **Python, JavaScript, Java, or C++** (or load a sample)
2. Add an example comment: `# Example: twoSum([2, 7, 11, 15], 9)` or `// Example: ...`
3. Click **Visualize** — instant pattern-based trace (no API key)
4. Use the step slider to scrub through execution

### Supported DSA patterns (any language)

| Pattern | Modes |
|---|---|
| Two Sum | Array + Hash Map |
| Bubble Sort | Array |
| Binary Search | Array |
| Reverse Linked List | Linked List |
| Combination Sum | Tree + Array |
| Subsets | Tree + Array |

JavaScript/TypeScript also supports **live code instrumentation** as a fallback for custom logic.

## Project Structure

```
src/
├── lib/
│   ├── engine/
│   │   ├── instrumentCode.ts   # Injects __trace__ hooks
│   │   ├── runSandbox.ts       # new Function() executor
│   │   ├── mergeStepsWithAI.ts # Template + trace merger
│   │   ├── analyzeLocally.ts   # Main orchestrator
│   │   └── templates/          # Static explanation packs
│   ├── scenarios/              # Pre-built demo timelines
│   └── types.ts
├── components/
│   ├── engine/                 # Canvas, player, TraceStepView
│   └── modes/                  # ARRAY, RESULT_ARRAY, HASH_MAP,
│                               # LINKED_LIST, TREE, GRID
└── app/api/templates/          # Optional slim Gemini endpoint
```

## License

MIT — see [LICENSE](LICENSE).

## Tech Stack

- [Next.js 15](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
