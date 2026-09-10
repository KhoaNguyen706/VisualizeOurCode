// One browser case per roadmap topic that needs the Pyodide harness to do
// something vitest cannot see: build a TreeNode/ListNode from a LeetCode
// list, stamp node ids, re-serialise the entry's roots on every step, run a
// multi-statement example. Loaded by browser-check.js.
module.exports = [
  {
    name: "py-tree-max-depth",
    language: "python",
    code: `class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        left = self.maxDepth(root.left)
        right = self.maxDepth(root.right)
        return 1 + max(left, right)

# Example: Solution().maxDepth([3, 9, 20, None, None, 15, 7])`,
    expectText: ["binary tree", "tree", "calls"],
    expectSvg: ["3", "9", "20", "15", "7"],
    forbidText: ["not a trace of your code", "__id"],
  },
  {
    name: "py-tree-invert",
    language: "python",
    code: `class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        if not root:
            return None
        root.left, root.right = root.right, root.left
        self.invertTree(root.left)
        self.invertTree(root.right)
        return root

# Example: Solution().invertTree([4, 2, 7, 1, 3, 6, 9])`,
    expectText: ["binary tree"],
    expectSvg: ["4", "2", "7", "1", "3", "6", "9"],
  },
  {
    name: "py-tree-level-order",
    language: "python",
    code: `class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        result = []
        q = deque([root] if root else [])
        while q:
            level = []
            for _ in range(len(q)):
                node = q.popleft()
                level.append(node.val)
                if node.left:
                    q.append(node.left)
                if node.right:
                    q.append(node.right)
            result.append(level)
        return result

# Example: Solution().levelOrder([3, 9, 20, None, None, 15, 7])`,
    expectText: ["queue", "tree", "node 20"],
    expectSvg: ["3", "9", "20"],
  },
  {
    name: "py-list-reverse",
    language: "python",
    code: `class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        cur = head
        while cur:
            nxt = cur.next
            cur.next = prev
            prev = cur
            cur = nxt
        return prev

# Example: Solution().reverseList([1, 2, 3, 4])`,
    expectText: ["linked list"],
    forbidText: ["not a trace of your code", "depth limit"],
  },
  {
    name: "py-list-cycle",
    language: "python",
    code: `class Solution:
    def hasCycle(self, head):
        if not head or not head.next:
            return False
        slow = head
        fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if slow == fast:
                return True
        return False

# Example: hasCycle([3,2,0,-4], pos=1)`,
    expectText: ["cycle detection", "return true"],
    forbidText: ["not a trace of your code"],
  },
  {
    name: "py-trie",
    language: "python",
    code: `class TrieNode:
    def __init__(self):
        self.children = {}
        self.end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.end = True

    def search(self, word: str) -> bool:
        node = self.root
        for ch in word:
            if ch not in node.children:
                return False
            node = node.children[ch]
        return node.end

# Example: t = Trie(); t.insert("app"); t.insert("apt"); t.search("app")`,
    expectText: ["trie"],
    expectSvg: ["root", "a", "p", "t", "end"],
    forbidText: ["not a trace of your code", "__id"],
  },
  {
    name: "py-intervals-merge",
    language: "python",
    code: `class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        intervals.sort(key=lambda x: x[0])
        merged = [intervals[0]]
        for i in range(1, len(intervals)):
            start, end = intervals[i]
            if start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        return merged

# Example: Solution().merge([[1, 3], [8, 10], [2, 6], [15, 18], [9, 12]])`,
    expectText: ["intervals", "merged"],
    // `merged = [intervals[0]]` shares the first pair, so the input's [1, 3]
    // really does become [1, 6] — the picture shows the aliasing.
    expectSvg: ["[1, 6]", "[15, 18]"],
    forbidText: ["dp table"],
  },
  {
    name: "py-bits-single-number",
    language: "python",
    code: `class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        res = 0
        for n in nums:
            res = res ^ n
        return res

# Example: Solution().singleNumber([4, 1, 2, 1, 2])`,
    expectText: ["bit manipulation", "bits", "most significant"],
  },
  {
    name: "py-union-find-forest",
    language: "python",
    code: `class Solution:
    def findRedundantConnection(self, edges: List[List[int]]) -> List[int]:
        parent = [i for i in range(len(edges) + 1)]

        def find(x):
            while parent[x] != x:
                x = parent[x]
            return x

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra == rb:
                return False
            parent[rb] = ra
            return True

        for a, b in edges:
            if not union(a, b):
                return [a, b]
        return []

# Example: Solution().findRedundantConnection([[1, 2], [1, 3], [2, 3]])`,
    expectText: ["advanced graphs", "forest"],
    expectSvg: ["0", "1", "2", "3"],
  },
  {
    name: "py-dp-1d-stairs",
    language: "python",
    code: `class Solution:
    def climbStairs(self, n: int) -> int:
        dp = [0] * (n + 1)
        dp[0] = 1
        dp[1] = 1
        for i in range(2, n + 1):
            dp[i] = dp[i - 1] + dp[i - 2]
        return dp[n]

# Example: Solution().climbStairs(6)`,
    expectText: ["1-d dynamic programming", "array"],
    forbidText: ["dp table"],
  },
  {
    name: "py-stack-daily-temperatures",
    language: "python",
    code: `class Solution:
    def dailyTemperatures(self, temperatures: List[int]) -> List[int]:
        result = [0] * len(temperatures)
        stack = []
        for i, t in enumerate(temperatures):
            while stack and temperatures[stack[-1]] < t:
                j = stack.pop()
                result[j] = i - j
            stack.append(i)
        return result

# Example: Solution().dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73])`,
    expectText: ["stack", "result"],
  },
  {
    name: "py-math-rotate",
    language: "python",
    code: `class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        n = len(matrix)
        for i in range(n):
            for j in range(i + 1, n):
                matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
        for row in matrix:
            row.reverse()

# Example: Solution().rotate([[1, 2, 3], [4, 5, 6], [7, 8, 9]])`,
    expectText: ["math & geometry", "grid"],
  },
];
