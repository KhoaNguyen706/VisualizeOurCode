import { analyzeLocally } from "../src/lib/engine/analyzeLocally";

const samples = [
  {
    lang: "python",
    code: `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
# Example: twoSum([2, 7, 11, 15], 9)`,
  },
  {
    lang: "java",
    code: `void bubbleSort(int[] arr) {
    for (int i = 0; i < arr.length - 1; i++)
        for (int j = 0; j < arr.length - i - 1; j++)
            if (arr[j] > arr[j + 1]) { int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t; }
}
// Example: bubbleSort([64, 34, 25, 12, 22, 11, 90])`,
  },
  {
    lang: "cpp",
    code: `int binarySearch(vector<int>& nums, int target) {
    int left = 0, right = nums.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
// Example: binarySearch([1, 3, 5, 7, 9, 11], 7)`,
  },
];

async function main() {
  for (const s of samples) {
    const r = await analyzeLocally(s.code, s.lang, { skipAIPlan: true });
    if ("error" in r) console.log(`[${s.lang}] FAIL:`, r.error);
    else console.log(`[${s.lang}] OK: ${r.source} ${r.pattern ?? ""} ${r.traceSteps} steps ${r.elapsedMs}ms — ${r.scenario.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
