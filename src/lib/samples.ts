export const CODE_SAMPLES = [
  {
    id: "two-sum-py",
    label: "Two Sum (Python)",
    language: "python",
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
    id: "bubble-sort-java",
    label: "Bubble Sort (Java)",
    language: "java",
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
  {
    id: "binary-search-cpp",
    label: "Binary Search (C++)",
    language: "cpp",
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
  {
    id: "combination-sum-py",
    label: "Combination Sum (Python)",
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
  },
  {
    id: "subsets-py",
    label: "Subsets (Python)",
    language: "python",
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
    id: "reverse-list-js",
    label: "Reverse Linked List (JS)",
    language: "javascript",
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
  {
    id: "product-except-self-py",
    label: "Product Except Self (Python)",
    language: "python",
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
    id: "is-same-tree-py",
    label: "Is Same Tree (Python)",
    language: "python",
    code: `def isSameTree(p, q):
    if not p and not q:
        return True
    if not p or not q or p.val != q.val:
        return False
    return isSameTree(p.left, q.left) and isSameTree(p.right, q.right)

# Example: isSameTree([1,2,3], [1,2,3])`,
  },
  {
    id: "has-cycle-py",
    label: "Has Cycle (Python)",
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
  },
  {
    id: "sliding-window-py",
    label: "Sliding Window (Python)",
    language: "python",
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
    id: "valid-parentheses-py",
    label: "Valid Parentheses (Python)",
    language: "python",
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
    id: "fib-recursion-py",
    label: "Fibonacci, recursive (Python) — call tree",
    language: "python",
    code: `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

# Example: fib(5)`,
  },
  {
    id: "num-islands-dfs-py",
    label: "Number of Islands, DFS (Python) — call tree + grid",
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
        return count

# Example: Solution().numIslands([["1","1","0"],["0","1","0"],["0","0","1"]])`,
  },
  {
    id: "grid-bfs-seen-py",
    label: "Walls and Gates, BFS + set (Python) — queue + grid",
    language: "python",
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
] as const;
