/**
 * A small tokenizer for the editor's colour layer.
 *
 * It only has to be good enough to make code readable — keywords, strings,
 * numbers, comments, the name being called — never to parse. Every character
 * of the input is returned in order, so the coloured layer lines up exactly
 * with the textarea it sits under.
 */
export type TokenType =
  | "plain"
  | "keyword"
  | "builtin"
  | "string"
  | "number"
  | "comment"
  | "example"
  | "func"
  | "punct"
  | "decorator";

export interface Token {
  type: TokenType;
  text: string;
}

const PY_KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self".split(" ")
);
const PY_BUILTINS = new Set(
  "abs all any bool dict enumerate float int len list map max min print range reversed set sorted str sum tuple zip deque defaultdict Counter heappush heappop heapify inf List Optional Dict Set Tuple".split(" ")
);

const JS_KEYWORDS = new Set(
  "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of static get set null undefined true false".split(" ")
);
const JS_BUILTINS = new Set(
  "Array Object Map Set Math Number String Boolean JSON console Infinity NaN parseInt parseFloat Promise Symbol".split(" ")
);

const C_KEYWORDS = new Set(
  "auto break case char class const continue default do double else enum extern float for goto if inline int long namespace new nullptr private protected public register return short signed sizeof static struct switch template this throw true false try typedef union unsigned using virtual void volatile while bool delete catch public boolean String final import package interface implements extends abstract instanceof null".split(" ")
);
const C_BUILTINS = new Set(
  "vector string map set unordered_map unordered_set pair queue deque stack priority_queue std cout endl printf Integer Math System List ArrayList HashMap HashSet Arrays Collections".split(" ")
);

type Rules = {
  keywords: Set<string>;
  builtins: Set<string>;
  lineComment: string[];
  blockComment: boolean;
  tripleQuote: boolean;
  decorators: boolean;
};

function rulesFor(language: string): Rules {
  const lang = language.toLowerCase();
  if (lang === "python" || lang === "py") {
    return {
      keywords: PY_KEYWORDS,
      builtins: PY_BUILTINS,
      lineComment: ["#"],
      blockComment: false,
      tripleQuote: true,
      decorators: true,
    };
  }
  if (lang === "java" || lang === "cpp" || lang === "c++" || lang === "c") {
    return {
      keywords: C_KEYWORDS,
      builtins: C_BUILTINS,
      lineComment: ["//"],
      blockComment: true,
      tripleQuote: false,
      decorators: lang === "java",
    };
  }
  return {
    keywords: JS_KEYWORDS,
    builtins: JS_BUILTINS,
    lineComment: ["//"],
    blockComment: true,
    tripleQuote: false,
    decorators: false,
  };
}

const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);
const isIdent = (ch: string) => /[\w$]/.test(ch);
const isDigit = (ch: string) => /[0-9]/.test(ch);

export function tokenize(code: string, language: string): Token[] {
  const rules = rulesFor(language);
  const out: Token[] = [];
  let i = 0;
  const n = code.length;

  const push = (type: TokenType, text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type && (type === "plain" || type === "punct")) {
      last.text += text;
    } else {
      out.push({ type, text });
    }
  };

  while (i < n) {
    const ch = code[i];
    const two = code.slice(i, i + 2);

    // Line comments — an "Example:" comment is the run's entry point, so it
    // gets its own colour rather than fading out with the other comments.
    const lc = rules.lineComment.find((m) => code.startsWith(m, i));
    if (lc) {
      let j = code.indexOf("\n", i);
      if (j === -1) j = n;
      const text = code.slice(i, j);
      push(/^\s*(#|\/\/)\s*example\s*:/i.test(text) ? "example" : "comment", text);
      i = j;
      continue;
    }

    if (rules.blockComment && two === "/*") {
      let j = code.indexOf("*/", i + 2);
      j = j === -1 ? n : j + 2;
      push("comment", code.slice(i, j));
      i = j;
      continue;
    }

    if (rules.tripleQuote && (code.startsWith('"""', i) || code.startsWith("'''", i))) {
      const q = code.slice(i, i + 3);
      let j = code.indexOf(q, i + 3);
      j = j === -1 ? n : j + 3;
      push("string", code.slice(i, j));
      i = j;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === ch) {
          j++;
          break;
        }
        // An unterminated quote ends at the line, so one stray quote does not
        // paint the rest of the file as a string.
        if (code[j] === "\n" && ch !== "`") break;
        j++;
      }
      push("string", code.slice(i, j));
      i = j;
      continue;
    }

    if (rules.decorators && ch === "@" && isIdentStart(code[i + 1] ?? "")) {
      let j = i + 1;
      while (j < n && (isIdent(code[j]) || code[j] === ".")) j++;
      push("decorator", code.slice(i, j));
      i = j;
      continue;
    }

    if (isDigit(ch) || (ch === "." && isDigit(code[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[\w.]/.test(code[j])) j++;
      push("number", code.slice(i, j));
      i = j;
      continue;
    }

    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(code[j])) j++;
      const word = code.slice(i, j);
      let k = j;
      while (k < n && (code[k] === " " || code[k] === "\t")) k++;
      const called = code[k] === "(";
      if (rules.keywords.has(word)) push("keyword", word);
      else if (rules.builtins.has(word)) push("builtin", word);
      else if (called) push("func", word);
      else push("plain", word);
      i = j;
      continue;
    }

    if (/[{}()[\];,.:=+\-*/%<>!&|^~?]/.test(ch)) {
      push("punct", ch);
      i++;
      continue;
    }

    push("plain", ch);
    i++;
  }

  return out;
}

/** Tokens split into lines, so each row of the layer maps to one source line. */
export function tokenizeLines(code: string, language: string): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokenize(code, language)) {
    const parts = token.text.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ type: token.type, text: part });
    });
  }
  return lines;
}
