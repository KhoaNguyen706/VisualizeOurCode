import { analyzeLocally } from "../src/lib/engine/analyzeLocally";

const gibberish = `def mystery(x):
    y = x + 1
    return y`;

const wrong = `def notTwoSum(a, b):
    for i in range(len(a)):
        print(a[i])
    return 0`;

async function main() {
  for (const [label, code] of [
    ["gibberish", gibberish],
    ["wrong", wrong],
    ["empty-ish", "for i in range(5): pass"],
  ] as const) {
    const r = await analyzeLocally(code, "python", { skipAIPlan: true });
    if ("error" in r) console.log(`[${label}] FAIL:`, r.error);
    else console.log(`[${label}] OK: ${r.pattern} warning=${!!r.warning} steps=${r.traceSteps}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
