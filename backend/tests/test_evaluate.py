import math
from dataclasses import dataclass
from datetime import date, timedelta

import pytest

from app import fsrs
from app.evaluate import CLIP, MIN_REVIEWS, SCHEDULERS, Prediction, histories, predictions, report, score
from app.models import Attempt, Difficulty, Pattern, Problem

DAY0 = date(2026, 10, 1)
FSRS = next(s for s in SCHEDULERS if s.name == "FSRS")


@dataclass
class FakeAttempt:
    attempted_on: date
    solved: bool = True
    confidence: int = 3
    used_hint: bool = False


def day(n: int) -> date:
    return DAY0 + timedelta(days=n)


def test_first_attempts_are_not_scored():
    assert predictions([[FakeAttempt(DAY0)], [FakeAttempt(day(5))]], FSRS) == []


def test_prediction_is_the_schedulers_retention_on_the_attempt_day():
    preds = predictions([[FakeAttempt(DAY0), FakeAttempt(day(4), solved=False)]], FSRS)
    expected = fsrs.retention(fsrs.update(None, fsrs.GOOD, DAY0), day(4))
    assert preds == [Prediction(expected, recalled=False)]


def test_attempts_are_replayed_in_date_order():
    history = [FakeAttempt(day(10)), FakeAttempt(DAY0), FakeAttempt(day(3))]
    assert [p.predicted for p in predictions([history], FSRS)] == [
        p.predicted for p in predictions([sorted(history, key=lambda a: a.attempted_on)], FSRS)
    ]


def test_same_day_repeats_are_skipped_but_still_update_state():
    history = [FakeAttempt(DAY0), FakeAttempt(DAY0, solved=False), FakeAttempt(day(3))]
    preds = predictions([history], FSRS)
    assert len(preds) == 1
    lapsed = fsrs.update(fsrs.update(None, fsrs.GOOD, DAY0), fsrs.AGAIN, DAY0)
    assert preds[0].predicted == fsrs.retention(lapsed, day(3))


def test_a_solve_with_a_hint_counts_as_recalled():
    preds = predictions([[FakeAttempt(DAY0), FakeAttempt(day(3), used_hint=True)]], FSRS)
    assert preds[0].recalled


@pytest.mark.parametrize("scheduler", SCHEDULERS, ids=lambda s: s.name)
def test_every_scheduler_is_scored_on_the_same_reviews(scheduler):
    history = [FakeAttempt(DAY0), FakeAttempt(day(2), solved=False), FakeAttempt(day(9))]
    preds = predictions([history], scheduler)
    assert [p.recalled for p in preds] == [False, True]
    assert all(0 <= p.predicted <= 1 for p in preds)


def test_score_metrics_by_hand():
    s = score([Prediction(0.8, True), Prediction(0.5, False)])
    assert s.reviews == 2
    assert s.log_loss == pytest.approx(-(math.log(0.8) + math.log(0.5)) / 2)
    assert s.rmse == pytest.approx(math.sqrt((0.2**2 + 0.5**2) / 2))
    assert (s.mean_predicted, s.mean_actual) == (pytest.approx(0.65), 0.5)


def test_confident_miss_is_clipped_not_infinite():
    assert score([Prediction(1.0, False)]).log_loss == pytest.approx(-math.log(CLIP))


def test_no_reviews_means_no_metrics():
    s = score([])
    assert (s.reviews, s.enough_data, s.log_loss, s.rmse) == (0, False, None, None)


def test_enough_data_threshold():
    assert not score([Prediction(0.9, True)] * (MIN_REVIEWS - 1)).enough_data
    assert score([Prediction(0.9, True)] * MIN_REVIEWS).enough_data


def test_histories_groups_attempts_by_problem_and_skips_unattempted(db):
    def problem(slug: str, *days: int) -> Problem:
        p = Problem(
            title=slug,
            link=f"https://leetcode.com/problems/{slug}/",
            pattern=Pattern.STACK,
            difficulty=Difficulty.EASY,
        )
        p.attempts = [
            Attempt(attempted_on=day(d), solved=True, duration_seconds=60, confidence=3) for d in days
        ]
        return p

    db.add_all([problem("a", 0, 4), problem("b", 1), problem("c")])
    db.flush()
    assert sorted(len(h) for h in histories(db)) == [1, 2]


def test_report_shows_a_row_per_scheduler_and_warns_on_little_data():
    s = score([Prediction(0.8, True), Prediction(0.5, False)])
    text = report({"SM-2": s, "FSRS": s})
    assert "Scored 2 repeat reviews" in text
    assert f"need {MIN_REVIEWS}" in text
    assert "SM-2" in text and "FSRS" in text and "0.65" in text


def test_report_with_no_reviews_has_no_table():
    text = report({"SM-2": score([]), "FSRS": score([])})
    assert "Scored 0" in text and "log loss" not in text
