# VisualizeOurCode

**Live: https://khoanguyen706.github.io/VisualizeOurCode/**

Paste your own LeetCode / DSA solution and watch it run, step by step. Python and
JavaScript execute for real in your browser — wrong answers included — and every
step is narrated from your own source line and the values it actually produced.

Free, no account, no API key, no AI. Everything runs on your machine.

## Features

- **Traces the code you wrote** — every step is derived from your own source line
  and the values it actually produced, never from a canned script
- **Instant client-side tracing** — instrument JS/TS code, execute it, visualize in under 100ms
- **Real Python, in the browser** — Python runs on actual CPython (Pyodide/WebAssembly)
  under `sys.settrace`, so the trace is your interpreter's, not an approximation
- **Visualization modes**: Array, Result Array, Hash Map, Linked List, Tree/Graph, Grid,
  and the queue / stack / set a traversal drives itself from
- **Step slider** — scrub through trace history with live variable watch panel, with
  the executing line highlighted in the editor gutter; the track is marked where the
  code decided something, returned, or stopped
- **Beats or every line** — the timeline folds bookkeeping into beats the canvas can
  show; flip to *Every line* for the debugger's view of the same run
- **Steps, Output, Shortcuts** — a clickable list of every step, the value the code
  returned and everything it printed, and keyboard control (Space, ← →, Home, End,
  ⌘↩ to run)
- **Share a link** — the code, language and test case travel in the URL fragment, so a
  friend opens the same program and it runs itself; nothing is uploaded anywhere
- **An editor that reads like one** — syntax colouring for Python, JavaScript, Java and
  C++, Tab indents, and panels you can drag to resize
- **The algorithm leads the picture** — a BFS shows its queue over the grid, a DP its
  table, a recursion the tree of calls it actually made; everything else the code
  builds is drawn after it, and nothing recognised means "draw what the code holds"
- **Pattern hints** — when your code resembles a known problem, the textbook approach
  is offered *beside* your trace instead of replacing it
- **Built-in demos** — Two Sum, Reverse Linked List, Combination Sum (zero latency)

## Architecture

```
Code → instrumentCode() → runSandbox() → traceHistory[]
                                              ↓
                                      narrateTrace()   ← your source lines + real values
                                              ↓
                                      condenseTrace()  ← fold bookkeeping into beats
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

### The algorithm leads the picture

The trace decides *what happened*; the source decides *what to draw first*.
`inferTechniquesFromCode()` reads every approach the code combines, lead first, and
the canvas orders its layers by the lead:

| Your code looks like | Drawn first | Then |
|---|---|---|
| BFS (`popleft`, `shift`) | the queue, then the grid or graph it walks | any set or map it keeps |
| DFS, backtracking, or any function that calls itself | the tree of calls it actually made — each node its real arguments, each finished call its return value | the stack it pushes and pops, the array it chooses from |
| Dynamic programming (`dp[`, `memo`) | the table, cells lit as they fill | the memo dict |
| Two pointers, sliding window, binary search | the array with the pointers or window on it | maps, sets |
| Hash map / hash set | the array being scanned and the map beside it | |
| Nothing recognised | whatever the code holds — arrays, dicts, lists, grids, queues | |

Supporting approaches are named as chips beside the lead one ("BFS + Hash Set"), so
a solution that combines several is read as the combination it is. The call tree is
built from the trace, not guessed: both sandboxes tag every step with the call it ran
in, its parent, the arguments it was entered with and its depth, and a wrong recursion
draws its wrong tree.

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
npm test        # vitest over the engine
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
  An inline early exit — `if (cond) return x;` — is traced as both the decision
  and the return; an inline `continue` or `break` is only the decision.
- **The entry point is the function nothing else calls.** With several functions,
  the one named in the `Example:` comment wins; otherwise the first one that is
  never called elsewhere in the code, so a `dfs` helper written above `numIslands`
  is not mistaken for the entry. Two mutually recursive functions fall back to
  the first.
- **`new Function()` is an execution wrapper, not a security boundary.** Traced
  code runs on the page with the same access as the rest of the app. That is
  acceptable here because you are running your own code in your own browser, and
  nothing is ever executed server-side — but it is not a sandbox in the isolation
  sense, and untrusted third-party code should not be pasted in.
- **Unbounded recursion** is not covered by the budgets above; it terminates via
  the engine's own stack overflow and surfaces as a normal execution error.
- **Call boundaries in JavaScript need a named function whose body closes on its
  own line** — `function f(a) {` or `const f = (a) => {`. A one-line function or a
  class method is still traced, but it does not appear in the call tree.
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

Open [http://localhost:3000](http://localhost:3000).

## Deploying

The app is a static site — there is no server, so it can be hosted anywhere that
serves files. `next build` writes it to `out/`.

The repository deploys itself to **GitHub Pages** on every push to `main`
(`.github/workflows/deploy.yml`). A project site lives under `/<repo>/`, so the
workflow builds with `NEXT_PUBLIC_BASE_PATH=/<repo>`; a local build without that
variable serves from `/`, which is what Vercel, Netlify or a plain web server want.

## Usage

1. Paste DSA code in **Python, JavaScript, Java, or C++** (or load a sample)
2. Add an example comment: `# Example: twoSum([2, 7, 11, 15], 9)` or `// Example: ...`
   — or type the input into the **Test case** field
3. Click **Visualize**
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
│   │   ├── runSandbox.ts       # new Function() executor with budgets
│   │   ├── narrateTrace.ts     # Trace → frames, in the author's own terms
│   │   ├── condenseTrace.ts    # Line frames → beats a viewer can follow
│   │   ├── patternHint.ts      # Textbook approach, shown beside the trace
│   │   ├── analyzeLocally.ts   # Main orchestrator
│   │   ├── python/             # Pyodide sandbox + settrace harness
│   │   └── technique/          # Which algorithm the code is shaped like
│   ├── dsa/                    # Pattern tracers (Java/C++ fallback)
│   ├── scenarios/              # Pre-built demo timelines
│   ├── samples.ts              # Code samples in the editor's menu
│   └── types.ts
└── components/
    ├── engine/                 # Canvas, player, TraceStepView,
    │                           # PatternHintBanner, StateInspector
    └── modes/                  # ARRAY, RESULT_ARRAY, HASH_MAP, LINKED_LIST,
                                # TREE, GRID, CONTAINER (queue/stack/set)
```

## License

MIT — see [LICENSE](LICENSE).

## Tech Stack

- [Next.js 15](https://nextjs.org/) (static export)
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Pyodide](https://pyodide.org/) for in-browser Python
