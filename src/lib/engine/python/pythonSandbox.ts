import type { SandboxResult } from "../runSandbox";
import {
  pythonStepsToTraceHistory,
  type PythonTracePayload,
} from "./detectPython";

/**
 * Run the author's own Python by executing real CPython in the browser
 * (Pyodide / WebAssembly) under `sys.settrace`, then reshape the line events
 * into the trace format the rest of the engine already narrates.
 *
 * The point of this tier is the same as the JavaScript one: describe what the
 * code *actually did*, wrong answers included — never a textbook substitute.
 * It stays free and offline-friendly (no server, no API key); the runtime runs
 * entirely on the user's machine and the browser caches it after first load.
 */

// v0.28.0 is a stable release with the classic `loadPyodide` global API.
const PYODIDE_VERSION = "v0.28.0";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

/** Mirror of the JS sandbox budget so a runaway loop can't hang the tab. */
const STEP_LIMIT = 500;

interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>;
  globals: { set(name: string, value: unknown): void };
}

type LoadPyodide = (opts: { indexURL: string }) => Promise<PyodideInterface>;

declare global {
  // eslint-disable-next-line no-var
  var loadPyodide: LoadPyodide | undefined;
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector("script[data-pyodide]")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.pyodide = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Pyodide runtime"));
    document.head.appendChild(script);
  });
}

/** Load Pyodide once and reuse it; the first call downloads the runtime. */
async function getPyodide(): Promise<PyodideInterface> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Python tracing is only available in the browser");
  }
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${PYODIDE_BASE}pyodide.js`);
      if (!globalThis.loadPyodide) {
        throw new Error("Pyodide loader did not initialise");
      }
      return globalThis.loadPyodide({ indexURL: PYODIDE_BASE });
    })().catch((err) => {
      // Reset so a later attempt can retry rather than reuse a rejected promise.
      pyodidePromise = null;
      throw err;
    });
  }
  return pyodidePromise;
}

/**
 * The tracing harness, written in Python. It:
 *   - compiles the user's source (plus the entry call) under filename "<user>",
 *   - installs a settrace hook that records only the user's own function frames,
 *   - snapshots each frame's locals into JSON-safe values at every line,
 *   - attaches the real return value on each frame's return event,
 *   - stops at STEP_LIMIT so an infinite loop truncates instead of hanging,
 *   - hands back a JSON string the JS side parses into a PythonTracePayload.
 */
const HARNESS = `
import sys, json

try:
    from collections import deque as _deque
except Exception:
    _deque = None

_steps = []
_halted = [False]

def _safe(v, depth=0):
    if depth > 6:
        return "[depth limit]"
    # json.dumps writes bare Infinity/NaN, which JSON.parse rejects outright --
    # and float("inf") is how half of interview Python seeds a min/max. Emitting
    # Python's own repr keeps the trace parseable and still shows the real value.
    if isinstance(v, float):
        if v != v:
            return "nan"
        if v == float("inf"):
            return "inf"
        if v == float("-inf"):
            return "-inf"
        return v
    if v is None or isinstance(v, bool) or isinstance(v, (int, float, str)):
        return v
    if isinstance(v, (list, tuple)):
        return [_safe(x, depth + 1) for x in list(v)[:100]]
    if isinstance(v, set):
        return [_safe(x, depth + 1) for x in list(v)[:100]]
    # A deque is the queue in every BFS; repr() would render it as the opaque
    # string "deque([(0, 2)])" instead of a structure the timeline can draw.
    if _deque is not None and isinstance(v, _deque):
        return [_safe(x, depth + 1) for x in list(v)[:100]]
    if isinstance(v, dict):
        return {str(k): _safe(x, depth + 1) for k, x in list(v.items())[:100]}
    d = getattr(v, "__dict__", None)
    if isinstance(d, dict):
        return {str(k): _safe(x, depth + 1) for k, x in list(d.items())[:100]}
    try:
        return repr(v)
    except Exception:
        return "<unrepr>"

def _snapshot(loc):
    out = {}
    for k, v in loc.items():
        if k.startswith("__") and k.endswith("__"):
            continue
        out[k] = _safe(v)
    return out

class _Stop(Exception):
    pass

_call_seq = [0]

def _tracer(frame, event, arg):
    if frame.f_code.co_filename != "<user>":
        return None
    # CO_OPTIMIZED marks a real function frame. Testing it skips both the module
    # frame and class bodies -- a "class Node:" body would otherwise open the
    # timeline with a couple of empty-locals steps the author never ran into.
    if not (frame.f_code.co_flags & 0x1):
        return None

    # Tag every step with the call it belongs to. The JS side pairs each line
    # with the state recorded after it, and that pairing is only valid within a
    # single call -- across a call boundary the next record holds another
    # frame's locals. A counter is used rather than id(frame), whose value is
    # recycled once a frame is freed.
    _call_seq[0] += 1
    _fid = _call_seq[0]

    def _local(frame, event, arg):
        if event == "line":
            if len(_steps) >= __STEP_LIMIT__:
                _halted[0] = True
                sys.settrace(None)
                raise _Stop()
            _steps.append({
                "line": frame.f_lineno,
                "frame": _fid,
                "vars": _snapshot(frame.f_locals),
            })
        elif event == "return":
            if _steps:
                _steps[-1]["returnValue"] = _safe(arg)
        return _local

    return _local

_src = __USER_SOURCE__ + "\\n__entry_result__ = " + __ENTRY_CALL__ + "\\n"

# LeetCode-style sources annotate with typing names -- "grid: List[List[int]]"
# -- and never import them, because the judge supplies them ambiently. Python
# evaluates annotations at def time, so a missing List is a NameError raised
# before a single line of the algorithm runs, and the whole trace is lost.
#
# These are seeded into exec's globals rather than prepended to the source: an
# extra import line would shift every recorded line number one off the editor
# gutter, and the trace's only job is to point at the line that really ran.
_globals = {}
try:
    import typing
    for _n in dir(typing):
        if not _n.startswith("_"):
            _globals[_n] = getattr(typing, _n)
except Exception:
    pass

# The judge preloads the standard containers and helpers too, so pasted
# solutions call deque(), defaultdict(int) and heappush() with no import line of
# their own. Both the module and the bare name are seeded, since solutions use
# "heapq.heappush" and "heappush" interchangeably.
#
# Seeding cannot mask anything the author wrote: this is only the starting
# globals, so their own import or assignment of the same name replaces it.
for _mod, _names in (
    ("collections", ("deque", "defaultdict", "Counter", "OrderedDict", "namedtuple")),
    ("heapq", ("heappush", "heappop", "heapify", "heappushpop", "heapreplace", "nlargest", "nsmallest")),
    ("bisect", ("bisect", "bisect_left", "bisect_right", "insort", "insort_left", "insort_right")),
    ("itertools", ("permutations", "combinations", "combinations_with_replacement", "product", "accumulate", "groupby", "chain", "count", "cycle", "islice")),
    ("functools", ("lru_cache", "cache", "reduce", "cmp_to_key")),
    ("math", ("inf", "nan", "gcd", "lcm", "ceil", "floor", "sqrt", "factorial", "comb", "perm", "isqrt")),
    ("string", ("ascii_lowercase", "ascii_uppercase", "ascii_letters", "digits")),
    ("operator", ()),
    ("random", ()),
    ("re", ()),
    ("sys", ()),
    ("copy", ()),
):
    try:
        _m = __import__(_mod)
        _globals[_mod] = _m
        for _n in _names:
            # Never let a member shadow its own module -- random.random would
            # otherwise rebind "random" from the module to the function.
            if _n != _mod and hasattr(_m, _n):
                _globals[_n] = getattr(_m, _n)
    except Exception:
        pass

_error = None
try:
    _code = compile(_src, "<user>", "exec")
    sys.settrace(_tracer)
    try:
        exec(_code, _globals)
    finally:
        sys.settrace(None)
except _Stop:
    pass
except Exception as e:
    _error = repr(e)

json.dumps({"steps": _steps, "halted": _halted[0], "error": _error})
`;

/**
 * Execute Python source and collect a trace of its own execution. Returns the
 * same `SandboxResult` shape as the JavaScript `runSandbox`, so the caller can
 * treat both languages identically.
 */
export async function runPythonTrace(
  rawCode: string,
  entryCall: string
): Promise<SandboxResult> {
  let py: PyodideInterface;
  try {
    py = await getPyodide();
  } catch (err) {
    return {
      traceHistory: [],
      returnValue: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    py.globals.set("__USER_SOURCE__", rawCode);
    py.globals.set("__ENTRY_CALL__", entryCall);
    const program = HARNESS.replace(/__STEP_LIMIT__/g, String(STEP_LIMIT));
    const raw = await py.runPythonAsync(program);
    const payload = JSON.parse(String(raw)) as PythonTracePayload;

    return {
      traceHistory: pythonStepsToTraceHistory(payload.steps, rawCode),
      returnValue: undefined,
      error: payload.error ?? undefined,
      halted: payload.halted || undefined,
    };
  } catch (err) {
    return {
      traceHistory: [],
      returnValue: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
