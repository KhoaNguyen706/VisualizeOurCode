import type { TopicId } from "./roadmap";

export interface CodeSample {
  id: string;
  label: string;
  language: string;
  /** Where on the roadmap this problem sits. */
  topic: TopicId;
  code: string;
}

/**
 * One or more worked problems per roadmap topic, in the shape LeetCode hands
 * them out — `class Solution`, typed signatures, no imports the judge would
 * supply — so that what a pasted solution looks like is what a sample looks
 * like. Every Python sample runs for real in the browser.
 */
export const CODE_SAMPLES: readonly CodeSample[] = [
  // ── Arrays & Hashing ──────────────────────────────────────────────────
  {
    id: "two-sum-py",
    label: "Two Sum",
    language: "python",
    topic: "arrays_hashing",
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
    id: "two-sum-js",
    label: "Two Sum (JavaScript)",
    language: "javascript",
    topic: "arrays_hashing",
    code: `function twoSum(nums, target) {
  const seen = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (complement in seen) return [seen[complement], i];
    seen[nums[i]] = i;
  }
  return [];
}

// Example: twoSum([2, 7, 11, 15], 9)`,
  },
  {
    id: "product-except-self-py",
    label: "Product of Array Except Self",
    language: "python",
    topic: "arrays_hashing",
    code: `def productExceptSelf(nums):
    n = len(nums)
    result = [1] * n
    for i in range(1, n):
        result[i] = result[i - 1] * nums[i - 1]
    curr_suffix = 1
    for i in range(n - 1, -1, -1):
        result[i] *= curr_suffix
        curr_suffix *= nums[i]
    return result

# Example: productExceptSelf([1, 2, 3, 4])`,
  },
  {
    id: "group-anagrams-py",
    label: "Group Anagrams",
    language: "python",
    topic: "arrays_hashing",
    code: `class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        groups = defaultdict(list)
        for s in strs:
            key = "".join(sorted(s))
            groups[key].append(s)
        return list(groups.values())

# Example: Solution().groupAnagrams(["eat","tea","tan","ate","nat","bat"])`,
  },
  {
    id: "bubble-sort-java",
    label: "Bubble Sort (Java)",
    language: "java",
    topic: "arrays_hashing",
    code: `void bubbleSort(int[] arr) {
    int n = arr.length;
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

// Example: bubbleSort([64, 34, 25, 12, 22, 11, 90])`,
  },

  // ── Two Pointers ──────────────────────────────────────────────────────
  {
    id: "valid-palindrome-py",
    label: "Valid Palindrome",
    language: "python",
    topic: "two_pointers",
    code: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        l, r = 0, len(s) - 1
        while l < r:
            while l < r and not s[l].isalnum():
                l += 1
            while l < r and not s[r].isalnum():
                r -= 1
            if s[l].lower() != s[r].lower():
                return False
            l += 1
            r -= 1
        return True

# Example: Solution().isPalindrome("racecar")`,
  },
  {
    id: "two-sum-ii-py",
    label: "Two Sum II (sorted input)",
    language: "python",
    topic: "two_pointers",
    code: `class Solution:
    def twoSum(self, numbers: List[int], target: int) -> List[int]:
        l, r = 0, len(numbers) - 1
        while l < r:
            s = numbers[l] + numbers[r]
            if s == target:
                return [l + 1, r + 1]
            if s < target:
                l += 1
            else:
                r -= 1
        return []

# Example: Solution().twoSum([1, 3, 4, 6, 8, 11], 10)`,
  },

  // ── Stack ─────────────────────────────────────────────────────────────
  {
    id: "valid-parentheses-py",
    label: "Valid Parentheses",
    language: "python",
    topic: "stack",
    code: `def isValid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for c in s:
        if c in '([{':
            stack.append(c)
        elif not stack or stack[-1] != pairs[c]:
            return False
        else:
            stack.pop()
    return not stack

# Example: isValid("()[]{}")`,
  },
  {
    id: "daily-temperatures-py",
    label: "Daily Temperatures (monotonic stack)",
    language: "python",
    topic: "stack",
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
  },

  // ── Binary Search ─────────────────────────────────────────────────────
  {
    id: "binary-search-py",
    label: "Binary Search",
    language: "python",
    topic: "binary_search",
    code: `class Solution:
    def search(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == target:
                return mid
            if nums[mid] < target:
                lo = mid + 1
            else:
                hi = mid - 1
        return -1

# Example: Solution().search([-1, 0, 3, 5, 9, 12], 9)`,
  },
  {
    id: "binary-search-cpp",
    label: "Binary Search (C++)",
    language: "cpp",
    topic: "binary_search",
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

  // ── Sliding Window ────────────────────────────────────────────────────
  {
    id: "sliding-window-py",
    label: "Max Sum Subarray of Size K",
    language: "python",
    topic: "sliding_window",
    code: `def maxSumSubarray(nums, k):
    left = 0
    window_sum = 0
    max_sum = 0
    for right in range(len(nums)):
        window_sum += nums[right]
        if right - left + 1 > k:
            window_sum -= nums[left]
            left += 1
        if right - left + 1 == k:
            max_sum = max(max_sum, window_sum)
    return max_sum

# Example: maxSumSubarray([2, 1, 5, 1, 3, 2], 3)`,
  },
  {
    id: "longest-substring-py",
    label: "Longest Substring Without Repeating Characters",
    language: "python",
    topic: "sliding_window",
    code: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        seen = set()
        left = 0
        best = 0
        for right in range(len(s)):
            while s[right] in seen:
                seen.remove(s[left])
                left += 1
            seen.add(s[right])
            best = max(best, right - left + 1)
        return best

# Example: Solution().lengthOfLongestSubstring("abcabcbb")`,
  },

  // ── Linked List ───────────────────────────────────────────────────────
  {
    id: "reverse-list-py",
    label: "Reverse Linked List",
    language: "python",
    topic: "linked_list",
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
  },
  {
    id: "has-cycle-py",
    label: "Linked List Cycle",
    language: "python",
    topic: "linked_list",
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
  },
  {
    id: "reverse-list-js",
    label: "Reverse Linked List (JavaScript)",
    language: "javascript",
    topic: "linked_list",
    code: `function reverseList(head) {
  let prev = null;
  let current = head;
  while (current !== null) {
    const next = current.next;
    current.next = prev;
    prev = current;
    current = next;
  }
  return prev;
}

// Example: reverseList({ value: 1, next: { value: 2, next: { value: 3, next: null } } })`,
  },

  // ── Trees ─────────────────────────────────────────────────────────────
  {
    id: "max-depth-py",
    label: "Maximum Depth of Binary Tree",
    language: "python",
    topic: "trees",
    code: `class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        left = self.maxDepth(root.left)
        right = self.maxDepth(root.right)
        return 1 + max(left, right)

# Example: Solution().maxDepth([3, 9, 20, None, None, 15, 7])`,
  },
  {
    id: "invert-tree-py",
    label: "Invert Binary Tree",
    language: "python",
    topic: "trees",
    code: `class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        if not root:
            return None
        root.left, root.right = root.right, root.left
        self.invertTree(root.left)
        self.invertTree(root.right)
        return root

# Example: Solution().invertTree([4, 2, 7, 1, 3, 6, 9])`,
  },
  {
    id: "level-order-py",
    label: "Binary Tree Level Order Traversal (BFS)",
    language: "python",
    topic: "trees",
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
  },
  {
    id: "is-same-tree-py",
    label: "Same Tree",
    language: "python",
    topic: "trees",
    code: `def isSameTree(p, q):
    if not p and not q:
        return True
    if not p or not q or p.val != q.val:
        return False
    return isSameTree(p.left, q.left) and isSameTree(p.right, q.right)

# Example: isSameTree([1,2,3], [1,2,3])`,
  },

  // ── Tries ─────────────────────────────────────────────────────────────
  {
    id: "trie-py",
    label: "Implement Trie (Prefix Tree)",
    language: "python",
    topic: "tries",
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
  },

  // ── Heap / Priority Queue ─────────────────────────────────────────────
  {
    id: "last-stone-weight-py",
    label: "Last Stone Weight",
    language: "python",
    topic: "heap",
    code: `import heapq

class Solution:
    def lastStoneWeight(self, stones: List[int]) -> int:
        heap = []
        for stone in stones:
            heapq.heappush(heap, -stone)

        while len(heap) > 1:
            x = heapq.heappop(heap)
            y = heapq.heappop(heap)
            if x != y:
                heapq.heappush(heap, x - y)

        return -heap[0] if heap else 0

# Example: Solution().lastStoneWeight([2, 7, 4, 1, 8, 1])`,
  },
  {
    id: "kth-largest-py",
    label: "Kth Largest Element in an Array",
    language: "python",
    topic: "heap",
    code: `class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        heap = []
        for n in nums:
            heappush(heap, n)
            if len(heap) > k:
                heappop(heap)
        return heap[0]

# Example: Solution().findKthLargest([3, 2, 1, 5, 6, 4], 2)`,
  },

  // ── Backtracking ──────────────────────────────────────────────────────
  {
    id: "subsets-py",
    label: "Subsets",
    language: "python",
    topic: "backtracking",
    code: `def subsets(nums):
    res = []
    def backtrack(i, subset):
        if i == len(nums):
            res.append(subset[:])
            return
        backtrack(i + 1, subset)
        subset.append(nums[i])
        backtrack(i + 1, subset)
        subset.pop()
    backtrack(0, [])
    return res

# Example: subsets([1, 2, 3])`,
  },
  {
    id: "combination-sum-py",
    label: "Combination Sum",
    language: "python",
    topic: "backtracking",
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
  },
  {
    id: "fib-recursion-py",
    label: "Fibonacci, plain recursion (call tree)",
    language: "python",
    topic: "backtracking",
    code: `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

# Example: fib(5)`,
  },

  // ── Graphs ────────────────────────────────────────────────────────────
  {
    id: "num-islands-dfs-py",
    label: "Number of Islands (DFS on a grid)",
    language: "python",
    topic: "graphs",
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
        return count

# Example: Solution().numIslands([["1","1","0"],["0","1","0"],["0","0","1"]])`,
  },
  {
    id: "grid-bfs-seen-py",
    label: "Walls and Gates (BFS + visited set)",
    language: "python",
    topic: "graphs",
    code: `from collections import deque

def wallsAndGates(rooms):
    INF = 2147483647
    rows, cols = len(rooms), len(rooms[0])
    q = deque()
    seen = set()
    for r in range(rows):
        for c in range(cols):
            if rooms[r][c] == 0:
                q.append((r, c))
                seen.add((r, c))
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and rooms[nr][nc] == INF and (nr, nc) not in seen:
                rooms[nr][nc] = rooms[r][c] + 1
                seen.add((nr, nc))
                q.append((nr, nc))
    return rooms

# Example: wallsAndGates([[2147483647,-1,0,2147483647],[2147483647,2147483647,2147483647,-1],[2147483647,-1,2147483647,-1],[0,-1,2147483647,2147483647]])`,
  },
  {
    id: "count-components-py",
    label: "Number of Connected Components (adjacency list)",
    language: "python",
    topic: "graphs",
    code: `class Solution:
    def countComponents(self, n: int, edges: List[List[int]]) -> int:
        adj = {i: [] for i in range(n)}
        for a, b in edges:
            adj[a].append(b)
            adj[b].append(a)

        seen = set()

        def dfs(node):
            for nei in adj[node]:
                if nei not in seen:
                    seen.add(nei)
                    dfs(nei)

        count = 0
        for i in range(n):
            if i not in seen:
                seen.add(i)
                dfs(i)
                count += 1
        return count

# Example: Solution().countComponents(5, [[0, 1], [1, 2], [3, 4]])`,
  },

  // ── 1-D Dynamic Programming ───────────────────────────────────────────
  {
    id: "climbing-stairs-py",
    label: "Climbing Stairs (tabulation)",
    language: "python",
    topic: "dp_1d",
    code: `class Solution:
    def climbStairs(self, n: int) -> int:
        dp = [0] * (n + 1)
        dp[0] = 1
        dp[1] = 1
        for i in range(2, n + 1):
            dp[i] = dp[i - 1] + dp[i - 2]
        return dp[n]

# Example: Solution().climbStairs(6)`,
  },
  {
    id: "house-robber-py",
    label: "House Robber",
    language: "python",
    topic: "dp_1d",
    code: `class Solution:
    def rob(self, nums: List[int]) -> int:
        dp = [0] * len(nums)
        for i in range(len(nums)):
            take = nums[i] + (dp[i - 2] if i >= 2 else 0)
            skip = dp[i - 1] if i >= 1 else 0
            dp[i] = max(take, skip)
        return dp[-1]

# Example: Solution().rob([2, 7, 9, 3, 1])`,
  },

  // ── Intervals ─────────────────────────────────────────────────────────
  {
    id: "merge-intervals-py",
    label: "Merge Intervals",
    language: "python",
    topic: "intervals",
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
  },

  // ── Greedy ────────────────────────────────────────────────────────────
  {
    id: "max-subarray-py",
    label: "Maximum Subarray (Kadane)",
    language: "python",
    topic: "greedy",
    code: `class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        cur_sum = 0
        max_sum = nums[0]
        for i in range(len(nums)):
            if cur_sum < 0:
                cur_sum = 0
            cur_sum += nums[i]
            max_sum = max(max_sum, cur_sum)
        return max_sum

# Example: Solution().maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4])`,
  },
  {
    id: "jump-game-py",
    label: "Jump Game",
    language: "python",
    topic: "greedy",
    code: `class Solution:
    def canJump(self, nums: List[int]) -> bool:
        reach = 0
        for i in range(len(nums)):
            if i > reach:
                return False
            reach = max(reach, i + nums[i])
        return True

# Example: Solution().canJump([2, 3, 1, 1, 4])`,
  },

  // ── Advanced Graphs ───────────────────────────────────────────────────
  {
    id: "redundant-connection-py",
    label: "Redundant Connection (union-find forest)",
    language: "python",
    topic: "advanced_graphs",
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
  },
  {
    id: "network-delay-py",
    label: "Network Delay Time (Dijkstra)",
    language: "python",
    topic: "advanced_graphs",
    code: `class Solution:
    def networkDelayTime(self, times: List[List[int]], n: int, k: int) -> int:
        adj = defaultdict(list)
        for u, v, w in times:
            adj[u].append((v, w))

        dist = {}
        heap = [(0, k)]
        while heap:
            d, node = heappop(heap)
            if node in dist:
                continue
            dist[node] = d
            for nei, w in adj[node]:
                if nei not in dist:
                    heappush(heap, (d + w, nei))

        return max(dist.values()) if len(dist) == n else -1

# Example: Solution().networkDelayTime([[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2)`,
  },

  // ── 2-D Dynamic Programming ───────────────────────────────────────────
  {
    id: "unique-paths-py",
    label: "Unique Paths",
    language: "python",
    topic: "dp_2d",
    code: `class Solution:
    def uniquePaths(self, m: int, n: int) -> int:
        dp = [[1] * n for _ in range(m)]
        for i in range(1, m):
            for j in range(1, n):
                dp[i][j] = dp[i - 1][j] + dp[i][j - 1]
        return dp[m - 1][n - 1]

# Example: Solution().uniquePaths(3, 4)`,
  },
  {
    id: "lcs-py",
    label: "Longest Common Subsequence",
    language: "python",
    topic: "dp_2d",
    code: `class Solution:
    def longestCommonSubsequence(self, text1: str, text2: str) -> int:
        m, n = len(text1), len(text2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if text1[i - 1] == text2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
        return dp[m][n]

# Example: Solution().longestCommonSubsequence("abcde", "ace")`,
  },

  // ── Bit Manipulation ──────────────────────────────────────────────────
  {
    id: "single-number-py",
    label: "Single Number (XOR)",
    language: "python",
    topic: "bit_manipulation",
    code: `class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        res = 0
        for n in nums:
            res = res ^ n
        return res

# Example: Solution().singleNumber([4, 1, 2, 1, 2])`,
  },
  {
    id: "hamming-weight-py",
    label: "Number of 1 Bits",
    language: "python",
    topic: "bit_manipulation",
    code: `class Solution:
    def hammingWeight(self, n: int) -> int:
        count = 0
        while n:
            count += n & 1
            n = n >> 1
        return count

# Example: Solution().hammingWeight(45)`,
  },

  // ── Math & Geometry ───────────────────────────────────────────────────
  {
    id: "rotate-image-py",
    label: "Rotate Image (in place)",
    language: "python",
    topic: "math_geometry",
    code: `class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        n = len(matrix)
        for i in range(n):
            for j in range(i + 1, n):
                matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
        for row in matrix:
            row.reverse()

# Example: Solution().rotate([[1, 2, 3], [4, 5, 6], [7, 8, 9]])`,
  },
  {
    id: "plus-one-py",
    label: "Plus One",
    language: "python",
    topic: "math_geometry",
    code: `class Solution:
    def plusOne(self, digits: List[int]) -> List[int]:
        i = len(digits) - 1
        while i >= 0:
            if digits[i] < 9:
                digits[i] += 1
                return digits
            digits[i] = 0
            i -= 1
        return [1] + digits

# Example: Solution().plusOne([1, 2, 9, 9])`,
  },
];
