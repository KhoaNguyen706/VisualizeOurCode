# VisualizeOurCode

A zero-cost, client-side **LeetCode / DSA Visualizer** built with Next.js, React, Tailwind CSS, and Framer Motion.

## Features

- **Instant client-side tracing** — instrument JS/TS code, execute in a sandbox, visualize in under 100ms
- **4 Visualization Modes**: Array, Hash Map, Linked List, Tree/Graph
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
│   └── modes/                  # ARRAY, HASH_MAP, LINKED_LIST, TREE
└── app/api/templates/          # Optional slim Gemini endpoint
```

## License

MIT — see [LICENSE](LICENSE).

## Tech Stack

- [Next.js 15](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
