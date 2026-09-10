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
import sys, json, io

try:
    from collections import deque as _deque
except Exception:
    _deque = None

_steps = []
_halted = [False]

def _safe(v, depth=0):
    # Deep enough for a 30-node list or a tree of that height; the item caps
    # below keep the breadth bounded. Six levels cut every real linked list.
    if depth > 30:
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
        # The object's identity travels with its fields, so the JS side can
        # tell which node of the tree a local like "cur" is pointing at, and
        # can close a cycle instead of unrolling it.
        out = {"__id": id(v)}
        for k, x in list(d.items())[:100]:
            out[str(k)] = _safe(x, depth + 1)
        return out
    try:
        return repr(v)
    except Exception:
        return "<unrepr>"

# LeetCode's own node classes, defined exactly as the judge defines them, so a
# pasted solution that never declares them still runs. A solution that does
# declare its own replaces these, since the author's source runs afterwards.
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def _build_list(items, pos=None):
    if not isinstance(items, (list, tuple)):
        return items
    nodes = [ListNode(x) for x in items]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if nodes and pos is not None and 0 <= pos < len(nodes):
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None

def _build_tree(items):
    # LeetCode's level-order form: [3, 9, 20, None, None, 15, 7].
    if not isinstance(items, (list, tuple)):
        return items
    if not items or items[0] is None:
        return None
    root = TreeNode(items[0])
    queue = [root]
    i = 1
    while queue and i < len(items):
        node = queue.pop(0)
        if i < len(items):
            v = items[i]
            i += 1
            if v is not None:
                node.left = TreeNode(v)
                queue.append(node.left)
        if i < len(items):
            v = items[i]
            i += 1
            if v is not None:
                node.right = TreeNode(v)
                queue.append(node.right)
    return root

def _is_node(v):
    return v is not None and not isinstance(v, (list, tuple, dict, str, int, float, bool)) and (
        hasattr(v, "next") or hasattr(v, "left") or hasattr(v, "right") or hasattr(v, "children")
    )

_TREE_NAMES = ("root", "root1", "root2", "subroot", "p", "q", "t1", "t2", "tree")
_LIST_NAMES = ("head", "l1", "l2", "list1", "list2", "heada", "headb", "node", "lst")

# The entry call's node arguments, re-serialised on every step so the whole
# structure is visible while a recursive call holds only its own subtree.
_entry_roots = {}

def _coerce_arg(name, ann, val, pos, src):
    import inspect as _inspect
    a = "" if ann is _inspect.Parameter.empty else str(ann)
    if "TreeNode" in a:
        if ("List[" in a or "list[" in a) and isinstance(val, list):
            return [_build_tree(x) for x in val]
        return _build_tree(val)
    if "ListNode" in a:
        if ("List[" in a or "list[" in a) and isinstance(val, list) and all(isinstance(x, (list, type(None))) for x in val):
            return [_build_list(x) for x in val]
        return _build_list(val, pos if name == "head" else None)
    if not a and isinstance(val, (list, tuple)):
        lname = name.lower()
        if lname in _TREE_NAMES and (".left" in src or ".right" in src):
            return _build_tree(val)
        if lname in _LIST_NAMES and ".next" in src:
            return _build_list(val, pos if name == "head" else None)
    return val

def _run_entry(expr, src):
    import ast as _ast
    import inspect as _inspect
    module = _ast.parse(expr, mode="exec")
    # A class-design problem is driven by several statements -- "t = Trie();
    # t.insert('app')" -- and those simply run as written.
    if len(module.body) != 1 or not isinstance(module.body[0], _ast.Expr):
        exec(compile(module, "<entry>", "exec"), _globals)
        return _globals.get("__entry_result__")
    call = module.body[0].value
    def ev(node):
        return eval(compile(_ast.Expression(node), "<entry>", "eval"), _globals)
    if not isinstance(call, _ast.Call):
        return ev(call)
    try:
        fn = ev(call.func)
    except NameError:
        # "hasCycle([3,2,0,-4])" on a class Solution: the name is a method, so
        # the class it belongs to is found and instantiated for it.
        if not isinstance(call.func, _ast.Name):
            raise
        owner = None
        for _v in list(_globals.values()):
            # Defined on the class itself -- so the author's own class, not a
            # seeded builtin that happens to inherit a method of that name.
            if isinstance(_v, type) and callable(vars(_v).get(call.func.id)):
                owner = _v
                break
        if owner is None:
            raise
        fn = getattr(owner(), call.func.id)
    args = [ev(a) for a in call.args]
    kwargs = {}
    for k in call.keywords:
        if k.arg:
            kwargs[k.arg] = ev(k.value)
    try:
        params = [p for p in _inspect.signature(fn).parameters.values() if p.name not in ("self", "cls")]
    except Exception:
        params = []
    # "pos=1" on a hasCycle example is where the tail links back to, in
    # LeetCode's own words; it is not an argument of the function.
    pos = None
    if "pos" in kwargs and not any(p.name == "pos" for p in params):
        pos = kwargs.pop("pos")
    for i, p in enumerate(params):
        if i < len(args):
            args[i] = _coerce_arg(p.name, p.annotation, args[i], pos, src)
        elif p.name in kwargs:
            kwargs[p.name] = _coerce_arg(p.name, p.annotation, kwargs[p.name], pos, src)
    _entry_roots.clear()
    for i, p in enumerate(params):
        v = args[i] if i < len(args) else kwargs.get(p.name)
        if _is_node(v) or (isinstance(v, list) and v and all(x is None or _is_node(x) for x in v)):
            _entry_roots[p.name] = v
    return fn(*args, **kwargs)

def _snapshot(loc):
    out = {}
    for k, v in loc.items():
        if k.startswith("__") and k.endswith("__"):
            continue
        # A nested def is a name in scope, not state. Snapshotting it through
        # its (empty) __dict__ drew every helper as an empty hash map.
        if callable(v):
            continue
        # The receiver of a LeetCode method is an empty object that says nothing.
        if k == "self" and not getattr(v, "__dict__", None):
            continue
        out[k] = _safe(v)
    return out

class _Stop(Exception):
    pass

_call_seq = [0]
_active = []

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

    # The call tree: who called this frame, how deep it sits, and the arguments
    # it was entered with -- everything a recursion needs to be drawn as the
    # tree of calls it really made.
    _parent = _active[-1] if _active else None
    _active.append(_fid)
    _depth = len(_active)
    _co = frame.f_code
    _fn = _co.co_name
    _args = {}
    for _n in _co.co_varnames[:_co.co_argcount + _co.co_kwonlyargcount]:
        if _n in ("self", "cls"):
            continue
        if _n in frame.f_locals:
            _args[_n] = _safe(frame.f_locals[_n])
    _raised = [False]

    def _local(frame, event, arg):
        if event == "line":
            if len(_steps) >= __STEP_LIMIT__:
                _halted[0] = True
                sys.settrace(None)
                raise _Stop()
            _rec = {
                "line": frame.f_lineno,
                "frame": _fid,
                "parent": _parent,
                "fn": _fn,
                "args": _args,
                "depth": _depth,
                "vars": _snapshot(frame.f_locals),
            }
            if _entry_roots:
                _rec["roots"] = {k: _safe(v) for k, v in _entry_roots.items()}
            _steps.append(_rec)
        elif event == "exception":
            _raised[0] = True
        elif event == "return":
            # The value goes on this frame's own last line. The last step
            # overall may belong to a callee that ran inside the return
            # expression -- "return go(n - 1) + go(n - 2)" -- and stamping it
            # there credited the child with its parent's result. A frame
            # leaving on an exception returns nothing worth stamping.
            if not _raised[0]:
                for _s in reversed(_steps):
                    if _s["frame"] == _fid:
                        _s["returnValue"] = _safe(arg)
                        break
            if _active and _active[-1] == _fid:
                _active.pop()
        return _local

    return _local

_src = __USER_SOURCE__ + "\\n__entry_result__ = __run_entry__(" + repr(__ENTRY_CALL__) + ")\\n"

# LeetCode-style sources annotate with typing names -- "grid: List[List[int]]"
# -- and never import them, because the judge supplies them ambiently. Python
# evaluates annotations at def time, so a missing List is a NameError raised
# before a single line of the algorithm runs, and the whole trace is lost.
#
# These are seeded into exec's globals rather than prepended to the source: an
# extra import line would shift every recorded line number one off the editor
# gutter, and the trace's only job is to point at the line that really ran.
_globals = {}
_globals["ListNode"] = ListNode
_globals["TreeNode"] = TreeNode
_globals["__run_entry__"] = lambda expr: _run_entry(expr, __USER_SOURCE__)
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
# print() is how most people debug; without this it went to the browser console
# where nobody looks. Captured for the Output panel, restored no matter what.
_stdout = io.StringIO()
_real_stdout = sys.stdout
try:
    _code = compile(_src, "<user>", "exec")
    sys.stdout = _stdout
    sys.settrace(_tracer)
    try:
        exec(_code, _globals)
    finally:
        sys.settrace(None)
        sys.stdout = _real_stdout
except _Stop:
    pass
except Exception as e:
    _error = repr(e)

json.dumps({"steps": _steps, "halted": _halted[0], "error": _error, "stdout": _stdout.getvalue()[:20000]})
`;

/**
 * What the entry call returned: the last `return` recorded in the outermost
 * call. The harness has no way to hand the value back directly — the entry
 * expression runs inside `exec` — but it records every return, and the
 * outermost one is the answer.
 */
function entryReturnValue(steps: SandboxResult["traceHistory"]): unknown {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if ("returnValue" in s && (s.depth ?? 1) <= 1) return s.returnValue;
  }
  return undefined;
}

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
    const traceHistory = pythonStepsToTraceHistory(payload.steps, rawCode);

    return {
      traceHistory,
      returnValue: entryReturnValue(traceHistory),
      stdout: payload.stdout || undefined,
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
