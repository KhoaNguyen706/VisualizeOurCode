import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

const PAIRS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

export function traceValidParentheses(inputs: DSAInputs): DSATracerResult {
  const raw =
    typeof (inputs as unknown as { s?: string }).s === "string"
      ? (inputs as unknown as { s: string }).s
      : "()[]{}";
  const s = raw;
  const frames: TimelineFrame[] = [];
  const stack: string[] = [];
  let step = 0;
  let valid = true;

  const push = (
    i: number,
    char: string,
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    frames.push({
      step: step++,
      mode: "ARRAY",
      overlayModes: ["ARRAY"],
      structures: {
        arrayData: s.split(""),
        mapData: stack.reduce((acc, c, idx) => {
          acc[`stack[${idx}]`] = c;
          return acc;
        }, {} as Record<string, string>),
        listData: [],
        treeData: [],
      },
      activePointers: { i },
      highlightedElements: [i],
      statusType: status,
      message,
      variables: {
        s,
        i,
        char,
        stack: [...stack],
      },
    });
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") {
      stack.push(c);
      push(i, c, "EXPLORE", `i=${i}: push '${c}' → stack=[${stack.join(",")}]`);
    } else if (c === ")" || c === "]" || c === "}") {
      const expected = PAIRS[c];
      const top = stack[stack.length - 1];
      if (top === expected) {
        stack.pop();
        push(i, c, "EXPLORE", `i=${i}: '${c}' matches '${expected}', pop → stack=[${stack.join(",")}]`);
      } else {
        valid = false;
        push(i, c, "FAIL", `i=${i}: '${c}' expected '${expected}' but got '${top ?? "empty"}'`);
        break;
      }
    }
  }

  if (valid && stack.length === 0) {
    push(s.length - 1, "", "SUCCESS", `Valid parentheses: stack is empty`);
  } else if (valid && stack.length > 0) {
    push(s.length - 1, "", "FAIL", `Invalid: ${stack.length} unclosed bracket(s)`);
  }

  return {
    timeline: frames,
    name: "Valid Parentheses",
    description: "Stack-based bracket matcher",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    primaryMode: "ARRAY",
  };
}
