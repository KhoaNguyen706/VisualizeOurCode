import { analyzeLocally } from "../src/lib/engine/analyzeLocally";

const twoSum = `function twoSum(nums, target) {
  const seen = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (complement in seen) return [seen[complement], i];
    seen[nums[i]] = i;
  }
  return [];
}
// Example: twoSum([2, 7, 11, 15], 9)`;

async function main() {
  const r = await analyzeLocally(twoSum, "javascript", { skipAIPlan: true });
  if ("error" in r) {
    console.error("FAIL:", r.error);
    process.exit(1);
  }
  console.log(`OK: ${r.elapsedMs}ms, ${r.traceSteps} steps`);
  r.scenario.timeline.forEach((f, i) => {
    console.log(`  [${i}] ${f.message} | vars: i=${f.variables?.i} complement=${f.variables?.complement}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
