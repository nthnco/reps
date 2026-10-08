"""preload neetcode 150

Revision ID: e4d957687cae
Revises: 0d75d3b68b13
Create Date: 2026-10-08 15:40:20.304204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert


# revision identifiers, used by Alembic.
revision: str = 'e4d957687cae'
down_revision: Union[str, Sequence[str], None] = '0d75d3b68b13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Plain strings, not app.models: a migration must keep working after the app's
# enums change. Titles, links and difficulties only, never statements.
# (pattern, [(slug, title, difficulty)]) in NeetCode roadmap order. Branch 7
# picks a pattern's next new problem by lowest id, so this order matters.
NEETCODE_150 = [
    ("arrays_hashing", [
        ("contains-duplicate", "Contains Duplicate", "easy"),
        ("valid-anagram", "Valid Anagram", "easy"),
        ("two-sum", "Two Sum", "easy"),
        ("group-anagrams", "Group Anagrams", "medium"),
        ("top-k-frequent-elements", "Top K Frequent Elements", "medium"),
        ("encode-and-decode-strings", "Encode and Decode Strings", "medium"),
        ("product-of-array-except-self", "Product of Array Except Self", "medium"),
        ("valid-sudoku", "Valid Sudoku", "medium"),
        ("longest-consecutive-sequence", "Longest Consecutive Sequence", "medium"),
    ]),
    ("two_pointers", [
        ("valid-palindrome", "Valid Palindrome", "easy"),
        ("two-sum-ii-input-array-is-sorted", "Two Sum II - Input Array Is Sorted", "medium"),
        ("3sum", "3Sum", "medium"),
        ("container-with-most-water", "Container With Most Water", "medium"),
        ("trapping-rain-water", "Trapping Rain Water", "hard"),
    ]),
    ("sliding_window", [
        ("best-time-to-buy-and-sell-stock", "Best Time to Buy and Sell Stock", "easy"),
        ("longest-substring-without-repeating-characters", "Longest Substring Without Repeating Characters", "medium"),
        ("longest-repeating-character-replacement", "Longest Repeating Character Replacement", "medium"),
        ("permutation-in-string", "Permutation in String", "medium"),
        ("minimum-window-substring", "Minimum Window Substring", "hard"),
        ("sliding-window-maximum", "Sliding Window Maximum", "hard"),
    ]),
    ("stack", [
        ("valid-parentheses", "Valid Parentheses", "easy"),
        ("min-stack", "Min Stack", "medium"),
        ("evaluate-reverse-polish-notation", "Evaluate Reverse Polish Notation", "medium"),
        ("daily-temperatures", "Daily Temperatures", "medium"),
        ("car-fleet", "Car Fleet", "medium"),
        ("largest-rectangle-in-histogram", "Largest Rectangle in Histogram", "hard"),
    ]),
    ("binary_search", [
        ("binary-search", "Binary Search", "easy"),
        ("search-a-2d-matrix", "Search a 2D Matrix", "medium"),
        ("koko-eating-bananas", "Koko Eating Bananas", "medium"),
        ("find-minimum-in-rotated-sorted-array", "Find Minimum in Rotated Sorted Array", "medium"),
        ("search-in-rotated-sorted-array", "Search in Rotated Sorted Array", "medium"),
        ("time-based-key-value-store", "Time Based Key-Value Store", "medium"),
        ("median-of-two-sorted-arrays", "Median of Two Sorted Arrays", "hard"),
    ]),
    ("linked_list", [
        ("reverse-linked-list", "Reverse Linked List", "easy"),
        ("merge-two-sorted-lists", "Merge Two Sorted Lists", "easy"),
        ("linked-list-cycle", "Linked List Cycle", "easy"),
        ("reorder-list", "Reorder List", "medium"),
        ("remove-nth-node-from-end-of-list", "Remove Nth Node From End of List", "medium"),
        ("copy-list-with-random-pointer", "Copy List with Random Pointer", "medium"),
        ("add-two-numbers", "Add Two Numbers", "medium"),
        ("find-the-duplicate-number", "Find the Duplicate Number", "medium"),
        ("lru-cache", "LRU Cache", "medium"),
        ("merge-k-sorted-lists", "Merge k Sorted Lists", "hard"),
        ("reverse-nodes-in-k-group", "Reverse Nodes in k-Group", "hard"),
    ]),
    ("trees", [
        ("invert-binary-tree", "Invert Binary Tree", "easy"),
        ("maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", "easy"),
        ("diameter-of-binary-tree", "Diameter of Binary Tree", "easy"),
        ("balanced-binary-tree", "Balanced Binary Tree", "easy"),
        ("same-tree", "Same Tree", "easy"),
        ("subtree-of-another-tree", "Subtree of Another Tree", "easy"),
        ("lowest-common-ancestor-of-a-binary-search-tree", "Lowest Common Ancestor of a Binary Search Tree", "medium"),
        ("binary-tree-level-order-traversal", "Binary Tree Level Order Traversal", "medium"),
        ("binary-tree-right-side-view", "Binary Tree Right Side View", "medium"),
        ("count-good-nodes-in-binary-tree", "Count Good Nodes in Binary Tree", "medium"),
        ("validate-binary-search-tree", "Validate Binary Search Tree", "medium"),
        ("kth-smallest-element-in-a-bst", "Kth Smallest Element in a BST", "medium"),
        ("construct-binary-tree-from-preorder-and-inorder-traversal", "Construct Binary Tree from Preorder and Inorder Traversal", "medium"),
        ("binary-tree-maximum-path-sum", "Binary Tree Maximum Path Sum", "hard"),
        ("serialize-and-deserialize-binary-tree", "Serialize and Deserialize Binary Tree", "hard"),
    ]),
    ("tries", [
        ("implement-trie-prefix-tree", "Implement Trie (Prefix Tree)", "medium"),
        ("design-add-and-search-words-data-structure", "Design Add and Search Words Data Structure", "medium"),
        ("word-search-ii", "Word Search II", "hard"),
    ]),
    ("heap", [
        ("kth-largest-element-in-a-stream", "Kth Largest Element in a Stream", "easy"),
        ("last-stone-weight", "Last Stone Weight", "easy"),
        ("k-closest-points-to-origin", "K Closest Points to Origin", "medium"),
        ("kth-largest-element-in-an-array", "Kth Largest Element in an Array", "medium"),
        ("task-scheduler", "Task Scheduler", "medium"),
        ("design-twitter", "Design Twitter", "medium"),
        ("find-median-from-data-stream", "Find Median from Data Stream", "hard"),
    ]),
    ("backtracking", [
        ("subsets", "Subsets", "medium"),
        ("combination-sum", "Combination Sum", "medium"),
        ("combination-sum-ii", "Combination Sum II", "medium"),
        ("permutations", "Permutations", "medium"),
        ("subsets-ii", "Subsets II", "medium"),
        ("generate-parentheses", "Generate Parentheses", "medium"),
        ("word-search", "Word Search", "medium"),
        ("palindrome-partitioning", "Palindrome Partitioning", "medium"),
        ("letter-combinations-of-a-phone-number", "Letter Combinations of a Phone Number", "medium"),
        ("n-queens", "N-Queens", "hard"),
    ]),
    ("graphs", [
        ("number-of-islands", "Number of Islands", "medium"),
        ("max-area-of-island", "Max Area of Island", "medium"),
        ("clone-graph", "Clone Graph", "medium"),
        ("walls-and-gates", "Walls and Gates", "medium"),
        ("rotting-oranges", "Rotting Oranges", "medium"),
        ("pacific-atlantic-water-flow", "Pacific Atlantic Water Flow", "medium"),
        ("surrounded-regions", "Surrounded Regions", "medium"),
        ("course-schedule", "Course Schedule", "medium"),
        ("course-schedule-ii", "Course Schedule II", "medium"),
        ("graph-valid-tree", "Graph Valid Tree", "medium"),
        ("number-of-connected-components-in-an-undirected-graph", "Number of Connected Components in an Undirected Graph", "medium"),
        ("redundant-connection", "Redundant Connection", "medium"),
        ("word-ladder", "Word Ladder", "hard"),
    ]),
    ("advanced_graphs", [
        ("network-delay-time", "Network Delay Time", "medium"),
        ("reconstruct-itinerary", "Reconstruct Itinerary", "hard"),
        ("min-cost-to-connect-all-points", "Min Cost to Connect All Points", "medium"),
        ("swim-in-rising-water", "Swim in Rising Water", "hard"),
        ("alien-dictionary", "Alien Dictionary", "hard"),
        ("cheapest-flights-within-k-stops", "Cheapest Flights Within K Stops", "medium"),
    ]),
    ("dp_1d", [
        ("climbing-stairs", "Climbing Stairs", "easy"),
        ("min-cost-climbing-stairs", "Min Cost Climbing Stairs", "easy"),
        ("house-robber", "House Robber", "medium"),
        ("house-robber-ii", "House Robber II", "medium"),
        ("longest-palindromic-substring", "Longest Palindromic Substring", "medium"),
        ("palindromic-substrings", "Palindromic Substrings", "medium"),
        ("decode-ways", "Decode Ways", "medium"),
        ("coin-change", "Coin Change", "medium"),
        ("maximum-product-subarray", "Maximum Product Subarray", "medium"),
        ("word-break", "Word Break", "medium"),
        ("longest-increasing-subsequence", "Longest Increasing Subsequence", "medium"),
        ("partition-equal-subset-sum", "Partition Equal Subset Sum", "medium"),
    ]),
    ("dp_2d", [
        ("unique-paths", "Unique Paths", "medium"),
        ("longest-common-subsequence", "Longest Common Subsequence", "medium"),
        ("best-time-to-buy-and-sell-stock-with-cooldown", "Best Time to Buy and Sell Stock with Cooldown", "medium"),
        ("coin-change-ii", "Coin Change II", "medium"),
        ("target-sum", "Target Sum", "medium"),
        ("interleaving-string", "Interleaving String", "medium"),
        ("longest-increasing-path-in-a-matrix", "Longest Increasing Path in a Matrix", "hard"),
        ("distinct-subsequences", "Distinct Subsequences", "hard"),
        ("edit-distance", "Edit Distance", "medium"),
        ("burst-balloons", "Burst Balloons", "hard"),
        ("regular-expression-matching", "Regular Expression Matching", "hard"),
    ]),
    ("greedy", [
        ("maximum-subarray", "Maximum Subarray", "medium"),
        ("jump-game", "Jump Game", "medium"),
        ("jump-game-ii", "Jump Game II", "medium"),
        ("gas-station", "Gas Station", "medium"),
        ("hand-of-straights", "Hand of Straights", "medium"),
        ("merge-triplets-to-form-target-triplet", "Merge Triplets to Form Target Triplet", "medium"),
        ("partition-labels", "Partition Labels", "medium"),
        ("valid-parenthesis-string", "Valid Parenthesis String", "medium"),
    ]),
    ("intervals", [
        ("insert-interval", "Insert Interval", "medium"),
        ("merge-intervals", "Merge Intervals", "medium"),
        ("non-overlapping-intervals", "Non-overlapping Intervals", "medium"),
        ("meeting-rooms", "Meeting Rooms", "easy"),
        ("meeting-rooms-ii", "Meeting Rooms II", "medium"),
        ("minimum-interval-to-include-each-query", "Minimum Interval to Include Each Query", "hard"),
    ]),
    ("math_geometry", [
        ("rotate-image", "Rotate Image", "medium"),
        ("spiral-matrix", "Spiral Matrix", "medium"),
        ("set-matrix-zeroes", "Set Matrix Zeroes", "medium"),
        ("happy-number", "Happy Number", "easy"),
        ("plus-one", "Plus One", "easy"),
        ("powx-n", "Pow(x, n)", "medium"),
        ("multiply-strings", "Multiply Strings", "medium"),
        ("detect-squares", "Detect Squares", "medium"),
    ]),
    ("bit_manipulation", [
        ("single-number", "Single Number", "easy"),
        ("number-of-1-bits", "Number of 1 Bits", "easy"),
        ("counting-bits", "Counting Bits", "easy"),
        ("reverse-bits", "Reverse Bits", "easy"),
        ("missing-number", "Missing Number", "easy"),
        ("sum-of-two-integers", "Sum of Two Integers", "medium"),
        ("reverse-integer", "Reverse Integer", "medium"),
    ]),
]

problems = sa.table(
    "problems",
    sa.column("title", sa.String),
    sa.column("link", sa.String),
    sa.column("pattern", sa.String),
    sa.column("difficulty", sa.String),
)


def _link(slug: str) -> str:
    # Already in normalize_leetcode_link's output form, so existing rows match.
    return f"https://leetcode.com/problems/{slug}/"


def upgrade() -> None:
    """Upgrade schema."""
    rows = [
        {"title": title, "link": _link(slug), "pattern": pattern, "difficulty": difficulty}
        for pattern, entries in NEETCODE_150
        for slug, title, difficulty in entries
    ]
    # One row per statement (executemany), so ids follow list order. Links
    # already saved are skipped, keeping the user's row, notes and attempts.
    op.get_bind().execute(
        pg_insert(problems).on_conflict_do_nothing(index_elements=["link"]),
        rows,
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove only untouched preload rows. A problem the user added before the
    # preload is indistinguishable if it also has no attempts and no notes.
    links = [_link(slug) for _, entries in NEETCODE_150 for slug, _, _ in entries]
    op.execute(
        sa.text(
            "DELETE FROM problems WHERE link = ANY(:links) AND notes = '' "
            "AND NOT EXISTS (SELECT 1 FROM attempts WHERE attempts.problem_id = problems.id)"
        ).bindparams(links=links)
    )
