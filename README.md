# VisualizeOurCode

A zero-cost, client-side **LeetCode / DSA Visualizer** built with Next.js, React, Tailwind CSS, and Framer Motion.

## Features

- **Traces the code you wrote** — every step is derived from your own source line
  and the values it actually produced, never from a canned script
- **Instant client-side tracing** — instrument JS/TS code, execute it, visualize in under 100ms
- **Real Python, in the browser** — Python runs on actual CPython (Pyodide/WebAssembly)
  under `sys.settrace`, so the trace is your interpreter's, not an approximation
- **6 Visualization Modes**: Array, Result Array, Hash Map, Linked List, Tree/Graph, Grid
- **Step slider** — scrub through trace history with live variable watch panel, with
  the executing line highlighted in the editor gutter
- **Pattern hints** — when your code resembles a known problem, the textbook approach
  is offered *beside* your trace instead of replacing it
- **Built-in demos** — Two Sum, Reverse Linked List, Combination Sum (zero latency)

## Architecture

```
Code → instrumentCode() → runSandbox() → traceHistory[]
                                              ↓
                                      narrateTrace()   ← your source lines + real values
                                              ↓
                                       TimelineFrame[]
                                              ↓
                                    Slider + VisualizationCanvas
```

`instrumentCode()` discovers the bindings a snippet actually declares — parameters,
`const`/`let`/`var`, destructured names, `for...of` heads — and records a snapshot at
each point that changes state: assignments, indexed writes, `++`/`--`, and mutating
method calls like `res.push(...)` or `seen.set(...)`. It also records **every loop
iteration and branch decision**, and captures each `return` expression's value, so
loop-driven code has a story to tell.

### Your code, not the textbook's

Pattern tracers used to run *first*. Because they key off the problem rather than the
solution, a brute-force Two Sum was narrated with the optimal algorithm's steps —
"Store map[2]=0" over code containing no map at all. First drafts are exactly what a
learner pastes in, so this was wrong in the case that matters most.

Now, whenever the code can genuinely be executed, it is — and `narrateTrace()` builds
each message from the author's own line plus what actually changed:

```
L2  Loop check i < nums.length  →  0 < nums.length → true
L3  Loop check j < nums.length  →  1 < nums.length → true — j = 1
L4  Check nums[i] + nums[j] === target  →  3 + 2 === 6 → false
L5  Return [i, j]  →  [1, 2]
```

Python takes the same route. Rather than pattern-match it, the app loads CPython into
the browser (Pyodide) and traces the real interpreter with `sys.settrace`, reshaping
its line events into the same `TraceStep[]` the JS sandbox emits — so one
`narrateTrace()` describes both languages and a wrong Python answer stays wrong on
screen. It stays free and keyless: the runtime downloads once and the browser caches it.

Pattern tracers still cover languages that cannot run here (Java, C++), where they are
labelled as the textbook walkthrough rather than a trace of your code.

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
npm test        # vitest, 70 tests over the engine
npm run typecheck
```

CI runs typecheck → test → build on every push and pull request.

## Known limits

- **Instrumentation is regex-based, not an AST walk.** A statement split across
  several lines is only seen at its first line. A `return` whose expression
  spans lines is traced but its value is not captured, since wrapping an
  unbalanced expression would not parse.
- **Constant loop conditions are not recorded.** `while (true)` would otherwise
  log "true → true" forever and let the step budget pre-empt the loop budget
  that exists to stop it. Such loops are still bounded by `__guard__`.
- **Only whole-line `if` / `else if` conditions become steps.** A ternary or a
  `&&` short-circuit buried inside an expression is not surfaced as a branch.
- **`new Function()` is an execution wrapper, not a security boundary.** Traced
  code runs on the page with the same access as the rest of the app. That is
  acceptable here because you are running your own code in your own browser, and
  nothing is ever executed server-side — but it is not a sandbox in the isolation
  sense, and untrusted third-party code should not be pasted in.
- **Unbounded recursion** is not covered by the budgets above; it terminates via
  the engine's own stack overflow and surfaces as a normal execution error.
- Java and C++ are matched to **pattern tracers**; only JavaScript/TypeScript and
  Python are genuinely executed.
- **The Python tier costs one download.** Pyodide is fetched from a CDN on first use
  (tens of MB, then cached by the browser), so the first Python run needs a network
  connection and takes a few seconds. Every run after that is local.
- **Python is bounded by the step budget alone.** 500 line events stop a runaway
  loop, but a single slow line (`sum(range(10**9))`) blocks until it finishes —
  there is no line-event to interrupt during one long call into C.
- **Non-finite Python floats are shown as `"inf"` / `"-inf"` / `"nan"`.** JSON has
  no way to carry them, so the trace uses Python's own repr rather than dropping
  the value or failing the run.

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

These are fallbacks. JavaScript, TypeScript and Python are executed directly, so custom
logic is traced rather than matched to one of the rows above.

## Project Structure

```
src/
├── lib/
│   ├── engine/
│   │   ├── instrumentCode.ts   # Injects __trace__/__cond__/__ret__ hooks
│   │   ├── runSandbox.ts       # new Function() executor
│   │   ├── narrateTrace.ts     # Trace → frames, in the author's own terms
│   │   ├── patternHint.ts      # Textbook approach, shown beside the trace
│   │   ├── mergeStepsWithAI.ts # Template merger (AI tier only)
│   │   ├── analyzeLocally.ts   # Main orchestrator
│   │   ├── python/             # Pyodide sandbox + settrace harness
│   │   └── templates/          # Static explanation packs
│   ├── scenarios/              # Pre-built demo timelines
│   └── types.ts
├── components/
│   ├── engine/                 # Canvas, player, TraceStepView,
│   │                           # PatternHintBanner
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
