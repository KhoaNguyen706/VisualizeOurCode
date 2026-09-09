// Browser check for the parts vitest cannot reach: the Pyodide harness, the call
// tree, the technique chips and the canvas, driven through the real app.
//
//   1. npm run dev                      (in this repo)
//   2. npm install playwright           (in any scratch directory)
//   3. NODE_PATH=<scratch>/node_modules node scripts/browser-check.js
//
// Uses the system Chrome (channel "chrome"), so no browser download is needed.
// Prints one report per case and writes screenshots next to this file; exits
// non-zero when a case fails. Set APP_URL if the dev server is not on :3000.
const { chromium } = require("playwright");
const path = require("path");

const URL = process.env.APP_URL || "http://localhost:3000";
const OUT = __dirname;

const CASES = [
  {
    name: "py-recursion-fib",
    language: "python",
    code: `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

# Example: fib(4)`,
    expectText: ["recursion", "recursion depth"],
    expectSvg: ["fib(4)", "→ 3"],
  },
  {
    name: "py-backtrack-combination-sum",
    language: "python",
    code: `def combinationSum(candidates, target):
    res = []
    def backtrack(i, path, total):
        if total == target:
            res.append(path[:])
            return
        if total > target or i == len(candidates):
            return
        path.append(candidates[i])
        backtrack(i, path, total + candidates[i])
        path.pop()
        backtrack(i + 1, path, total)
    backtrack(0, [], 0)
    return res

# Example: combinationSum([2, 3, 6, 7], 7)`,
    expectText: ["backtracking", "stack", "path"],
    forbidText: ["hash map", "grid"],
    expectSvg: ["(0, [], 0)"],
  },
  {
    name: "py-grid-bfs-with-set",
    language: "python",
    code: `from collections import deque
from typing import List

class Solution:
    def islandsAndTreasure(self, grid: List[List[int]]) -> None:
        rows, cols = len(grid), len(grid[0])
        q = deque()
        seen = set()
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 0:
                    q.append((r, c))
                    seen.add((r, c))
        while q:
            r, c = q.popleft()
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 2147483647 and (nr, nc) not in seen:
                    grid[nr][nc] = grid[r][c] + 1
                    seen.add((nr, nc))
                    q.append((nr, nc))`,
    testCase: "[[2147483647,-1,0],[2147483647,2147483647,2147483647],[0,-1,2147483647]]",
    expectText: ["bfs", "hash set", "queue", "grid"],
    forbidText: ["self {}"],
  },
  {
    name: "py-leetcode-dfs-islands",
    language: "python",
    code: `class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        rows, cols = len(grid), len(grid[0])
        count = 0
        def dfs(r, c):
            if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] != "1":
                return
            grid[r][c] = "0"
            dfs(r + 1, c)
            dfs(r - 1, c)
            dfs(r, c + 1)
            dfs(r, c - 1)
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "1":
                    dfs(r, c)
                    count += 1
        return count`,
    testCase: '[["1","1","0"],["0","1","0"],["0","0","1"]]',
    expectText: ["dfs", "calls"],
    forbidText: ["hash map"],
    expectSvg: ["(0, 0)"],
  },
  {
    name: "py-error-inside-recursion",
    language: "python",
    code: `def depth(n):
    if n == 2:
        return 1 // 0
    return depth(n + 1) + 1

# Example: depth(0)`,
    expectText: ["runtime error", "zerodivisionerror"],
    expectSvg: ["depth(0)", "depth(2)"],
  },
  {
    name: "py-dp-with-inf",
    language: "python",
    code: `def coinChange(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1

# Example: coinChange([1, 2, 5], 6)`,
    expectText: ["dynamic programming"],
    forbidText: ["not a trace of your code"],
  },
  {
    name: "py-infinite-loop",
    language: "python",
    code: `def spin(n):
    count = 0
    while True:
        count += 1
    return count

# Example: spin(1)`,
    expectText: ["budget"],
  },
  {
    name: "js-recursion-fib",
    language: "javascript",
    code: `function fib(n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}
// Example: fib(4)`,
    expectText: ["recursion"],
    expectSvg: ["fib(4)", "→ 3"],
  },
];

const STEP_COUNTER = /(\d+)\s*\/\s*(\d+)/;

async function settle(page) {
  // The button reads Tracing… / Loading Python… while a run is in flight; the
  // first Python run downloads Pyodide, so give it a long leash.
  await page.waitForFunction(
    () => !/Tracing…|Loading Python…/.test(document.body.innerText),
    null,
    { timeout: 180000 }
  );
}

const bodyText = (page) => page.evaluate(() => document.body.innerText);

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForSelector("textarea", { timeout: 10000 });
      break;
    } catch {
      await page.waitForTimeout(2000);
    }
  }

  let failures = 0;
  for (const c of CASES) {
    console.log(`\n=== ${c.name}`);
    await page.selectOption('select[aria-label="Language"]', c.language);
    await page.fill("textarea", c.code);
    await page.fill("#test-case-input", c.testCase ?? "");
    await page.click('button:has-text("Visualize")');
    await page.waitForTimeout(300);
    await settle(page);

    const total = Number(((await bodyText(page)).match(STEP_COUNTER) || [])[2] || 0);
    const fwd = page.locator('button[aria-label="Step forward"], button[title="Step forward"]').first();
    let guard = 0;
    let midBody = "";
    while ((await fwd.count()) > 0 && (await fwd.isEnabled()) && guard++ < 600) {
      await fwd.click();
      if (guard === Math.max(1, Math.floor(total * 0.6))) {
        await page.waitForTimeout(300);
        midBody = await bodyText(page);
        await page.screenshot({ path: path.join(OUT, `${c.name}-mid.png`), fullPage: false });
      }
    }
    await page.waitForTimeout(400);

    const endBody = await bodyText(page);
    const body = `${midBody}\n${endBody}`.toLowerCase();
    const svgTexts = await page.$$eval("svg text", (els) => els.map((e) => e.textContent || ""));
    const chips = await page.$$eval("main span.uppercase, main h3.uppercase", (els) =>
      els.map((e) => (e.textContent || "").trim()).filter(Boolean)
    );
    const errorPanel = await page.$('[aria-label="Dismiss"]');

    const problems = [];
    for (const t of c.expectText ?? []) if (!body.includes(t.toLowerCase())) problems.push(`missing text "${t}"`);
    for (const t of c.forbidText ?? []) if (body.includes(t.toLowerCase())) problems.push(`unexpected text "${t}"`);
    for (const t of c.expectSvg ?? []) if (!svgTexts.some((s) => s.includes(t))) problems.push(`missing node "${t}"`);
    if (errorPanel && !(c.expectText ?? []).some((t) => /runtime error/i.test(t))) problems.push("error panel shown");

    console.log(`  steps: ${(endBody.match(STEP_COUNTER) || ["?"])[0]}  nodes: ${svgTexts.filter((s) => /\(/.test(s)).length}`);
    console.log(`  chips: ${chips.join(" | ")}`);
    const warn = endBody.match(/(Runtime error[^\n]*|Execution stopped[^\n]*|not a trace of your code[^\n]*|raised an error[^\n]*)/);
    if (warn) console.log(`  note: ${warn[1]}`);
    if (errorPanel) {
      const text = await errorPanel.evaluate((el) => el.parentElement.innerText);
      console.log(`  ERROR PANEL: ${text.trim().slice(0, 200)}`);
    }
    if (problems.length) {
      failures += 1;
      console.log(`  FAIL: ${problems.join("; ")}`);
    } else {
      console.log("  ok");
    }
    await page.screenshot({ path: path.join(OUT, `${c.name}.png`), fullPage: false });
  }

  await browser.close();
  console.log(`\n${failures === 0 ? "ALL OK" : `${failures} case(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
