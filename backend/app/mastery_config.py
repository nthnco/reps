"""Every tunable number behind pattern mastery, in one place."""

from app.models import Difficulty, Pattern

# Mastery is an EWMA of attempt scores: ALPHA * new + (1 - ALPHA) * old.
# 0.5: the latest attempt counts for half, so one failure takes 0.9 to 0.45,
# and two in a row to about 0.22.
EWMA_ALPHA = 0.5

# Score for a clean solve (no hint, within the time limit), by difficulty.
# Easy stays below MASTERED_AT, so easies alone never make a pattern mastered.
SCORE_CLEAN = {
    Difficulty.EASY: 0.5,
    Difficulty.MEDIUM: 0.9,
    Difficulty.HARD: 1.0,
}
HINT_OR_SLOW_FACTOR = 0.6  # a hint or slow solve scores this fraction of clean
SCORE_FAILED = 0.0

# Stretching shouldn't be punished: a hint or slow solve at these difficulties
# never drops mastery below this level (a clean solve never drops it at all).
STRETCH_FLOOR = {
    Difficulty.HARD: SCORE_CLEAN[Difficulty.MEDIUM],
}

# Roughly what an interviewer allows per problem, with some leniency.
# A solve longer than this (not equal) counts as slow.
SLOW_AFTER_SECONDS = {
    Difficulty.EASY: 15 * 60,
    Difficulty.MEDIUM: 25 * 60,
    Difficulty.HARD: 35 * 60,
}

# Certainty = n / (n + CERTAINTY_K), n = attempts across all of a pattern's
# problems: how much evidence is behind a mastery score. Reaches 0.5 at n = K.
CERTAINTY_K = 5
# Below this a pattern is "low data": faded in the UI and never a strength.
MIN_CERTAINTY = 0.5

# Decay never cuts displayed mastery below this fraction of the raw score.
RETENTION_FLOOR = 0.2

# How much each pattern counts toward the overall rating. Equal for now.
PATTERN_WEIGHTS = {pattern: 1.0 for pattern in Pattern}
# A pattern counts toward the overall rating only once this many distinct
# problems in it have been attempted; untouched patterns show as coverage instead.
OVERALL_MIN_PROBLEMS = 2

# Displayed mastery at or above this is "mastered": it can be a strength (with
# enough certainty) and is never a weakness.
MASTERED_AT = 0.6
SUMMARY_TOP_N = 3
