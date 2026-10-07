"""Every tunable number behind pattern mastery, in one place."""

from app.models import Difficulty, Pattern

# Mastery is an EWMA of attempt scores: ALPHA * new + (1 - ALPHA) * old.
# 0.7 is very reactive: one failure takes 1.0 down to 0.3.
EWMA_ALPHA = 0.7

SCORE_CLEAN = 1.0  # solved, no hint, within the time limit
SCORE_HINT_OR_SLOW = 0.6
SCORE_FAILED = 0.0

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

# Displayed mastery at or above this is "mastered": it can be a strength (with
# enough certainty) and is never a weakness.
MASTERED_AT = 0.6
SUMMARY_TOP_N = 3
