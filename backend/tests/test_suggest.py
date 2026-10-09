from dataclasses import dataclass, field
from datetime import date, timedelta
from itertools import count

from app.models import Difficulty, Pattern
from app.suggest import Reason, covered_patterns, is_covered, suggest, tier_counts

E, M, H = Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD
FIRST, SECOND = Pattern.ARRAYS_HASHING, Pattern.TWO_POINTERS
DAY0 = date(2026, 10, 1)
_ids = count(1)
_days = count()


@dataclass
class FakeAttempt:
    solved: bool = True
    used_hint: bool = False
    # Each new attempt lands a day after the last, so creation order is timeline order.
    attempted_on: date = field(default_factory=lambda: DAY0 + timedelta(days=next(_days)))
    id: int = field(default_factory=lambda: next(_ids))


@dataclass
class FakeProblem:
    difficulty: Difficulty
    pattern: Pattern = FIRST
    attempts: list[FakeAttempt] = field(default_factory=list)
    id: int = field(default_factory=lambda: next(_ids))


def solved(difficulty, pattern=FIRST, hint=False):
    return FakeProblem(difficulty, pattern, [FakeAttempt(used_hint=hint)])


def failed(difficulty, pattern=FIRST):
    return FakeProblem(difficulty, pattern, [FakeAttempt(solved=False)])


def covered(pattern):
    return [solved(M, pattern), solved(M, pattern, hint=True)]


def every_other_pattern_covered():
    return [p for pattern in Pattern if pattern != FIRST for p in covered(pattern)]


# --- covered ---


def test_two_mediums_with_one_hint_free_cover_a_pattern():
    assert is_covered([solved(M), solved(M, hint=True)])


def test_hinted_mediums_alone_dont_cover():
    assert not is_covered([solved(M, hint=True), solved(M, hint=True)])


def test_one_medium_solved_twice_doesnt_cover():
    medium = FakeProblem(M, attempts=[FakeAttempt(), FakeAttempt()])
    assert not is_covered([medium])


def test_easies_and_hards_dont_count_toward_covered():
    assert not is_covered([solved(E), solved(E), solved(H), solved(M)])


def test_a_later_failure_doesnt_uncover():
    medium = solved(M)
    medium.attempts.append(FakeAttempt(solved=False))
    assert is_covered([medium, solved(M)])


def test_covered_patterns_lists_every_pattern():
    result = covered_patterns(covered(SECOND))
    assert result[SECOND] and not result[FIRST]
    assert set(result) == set(Pattern)


def test_tier_counts_count_distinct_solved_problems_hints_allowed():
    twice = FakeProblem(M, attempts=[FakeAttempt(), FakeAttempt()])
    problems = [twice, solved(M, hint=True), failed(M), solved(E), FakeProblem(H), solved(E, SECOND)]

    counts = tier_counts(problems)

    assert counts[FIRST].solved == {E: 1, M: 2, H: 0}
    assert counts[FIRST].total == {E: 1, M: 3, H: 1}
    assert counts[SECOND].solved == {E: 1, M: 0, H: 0}
    assert set(counts) == set(Pattern)


# --- which pattern ---


def test_suggests_the_earliest_uncovered_pattern_in_roadmap_order():
    second_easy = FakeProblem(E, SECOND)
    problems = [*covered(FIRST), FakeProblem(M, FIRST), second_easy]
    s = suggest(problems, {})
    assert s is not None
    assert (s.pattern, s.problem, s.reason) == (SECOND, second_easy, Reason.START_EASY)


# --- tier ---


def test_starts_on_the_lowest_id_easy():
    later, earlier = FakeProblem(E), FakeProblem(E)
    earlier.id = later.id - 1
    s = suggest([FakeProblem(M), later, earlier], {})
    assert s is not None and s.problem is earlier


def test_one_hint_free_easy_moves_on_to_mediums():
    medium = FakeProblem(M)
    s = suggest([solved(E), FakeProblem(E), medium], {})
    assert s is not None and (s.problem, s.reason) == (medium, Reason.NEXT_MEDIUM)


def test_one_hinted_easy_stays_on_easies():
    easy = FakeProblem(E)
    s = suggest([solved(E, hint=True), easy, FakeProblem(M)], {})
    assert s is not None and s.problem is easy


def test_two_hinted_easies_move_on_to_mediums():
    medium = FakeProblem(M)
    problems = [solved(E, hint=True), solved(E, hint=True), FakeProblem(E), medium]
    s = suggest(problems, {})
    assert s is not None and s.problem is medium


def test_pattern_without_easies_starts_on_mediums():
    medium = FakeProblem(M)
    s = suggest([medium, FakeProblem(H)], {})
    assert s is not None and (s.problem, s.reason) == (medium, Reason.NEXT_MEDIUM)


def test_no_easies_left_moves_up_to_mediums():
    medium = FakeProblem(M)
    s = suggest([failed(E), medium], {})
    assert s is not None and s.problem is medium


def test_uncovered_pattern_never_gets_a_hard():
    s = suggest([solved(M), FakeProblem(H)], {})
    assert s is not None and (s.problem, s.reason) == (None, Reason.KEEP_REVIEWING)


def test_failed_problems_are_never_new():
    s = suggest([solved(E), failed(M)], {})
    assert s is not None and (s.problem, s.reason) == (None, Reason.KEEP_REVIEWING)


# --- step back ---


def test_two_failed_mediums_step_back_to_an_easy():
    easy = FakeProblem(E)
    problems = [solved(E), easy, failed(M), failed(M), FakeProblem(M)]
    s = suggest(problems, {})
    assert s is not None and (s.problem, s.reason) == (easy, Reason.STEP_BACK)


def test_a_solve_after_one_failure_doesnt_step_back():
    medium = FakeProblem(M)
    problems = [solved(E), FakeProblem(E), failed(M), solved(M, hint=True), medium]
    s = suggest(problems, {})
    assert s is not None and s.problem is medium


def test_step_back_never_goes_below_the_lowest_tier():
    medium = FakeProblem(M)
    s = suggest([failed(M), failed(M), medium], {})
    assert s is not None and (s.problem, s.reason) == (medium, Reason.NEXT_MEDIUM)


def test_step_back_with_no_easies_left_offers_a_medium_not_a_step_back():
    medium = FakeProblem(M)
    s = suggest([solved(E), failed(M), failed(M), medium], {})
    assert s is not None and (s.problem, s.reason) == (medium, Reason.NEXT_MEDIUM)


def test_two_failed_hards_step_back_to_mediums():
    medium = FakeProblem(M)
    problems = [solved(E), FakeProblem(E), failed(H), failed(H), medium]
    s = suggest(problems, {})
    assert s is not None and (s.problem, s.reason) == (medium, Reason.STEP_BACK)


# --- every pattern covered ---


def test_all_covered_suggests_a_medium_in_the_weakest_pattern():
    weak_medium = FakeProblem(M, SECOND)
    problems = [*covered(FIRST), *every_other_pattern_covered(), FakeProblem(M, FIRST), weak_medium]
    mastery = {p: 0.8 for p in Pattern} | {SECOND: 0.3}
    s = suggest(problems, mastery)
    assert s is not None
    assert (s.pattern, s.problem, s.reason) == (SECOND, weak_medium, Reason.DEEPEN)


def test_all_covered_mastery_ties_keep_roadmap_order():
    first_medium = FakeProblem(M, FIRST)
    problems = [*covered(FIRST), *every_other_pattern_covered(), first_medium, FakeProblem(M, SECOND)]
    s = suggest(problems, {p: 0.5 for p in Pattern})
    assert s is not None and s.problem is first_medium


def test_all_covered_skips_patterns_without_new_mediums():
    medium = FakeProblem(M, SECOND)
    problems = [*covered(FIRST), *every_other_pattern_covered(), FakeProblem(E, FIRST), medium]
    s = suggest(problems, {FIRST: 0.1, SECOND: 0.9})
    assert s is not None and s.problem is medium


def test_all_covered_hards_wait_until_no_medium_is_left_anywhere():
    weak_hard, strong_medium = FakeProblem(H, FIRST), FakeProblem(M, SECOND)
    problems = [*covered(FIRST), *every_other_pattern_covered(), weak_hard, strong_medium]
    mastery = {FIRST: 0.1, SECOND: 0.9}
    s = suggest(problems, mastery)
    assert s is not None and s.problem is strong_medium

    strong_medium.attempts.append(FakeAttempt())
    s = suggest(problems, mastery)
    assert s is not None and (s.problem, s.reason) == (weak_hard, Reason.DEEPEN)


def test_all_covered_with_nothing_new_suggests_nothing():
    assert suggest([*covered(FIRST), *every_other_pattern_covered()], {}) is None
