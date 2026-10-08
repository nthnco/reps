import pytest

from app.evaluate import SCHEDULERS, predictions, score
from app.simulate import simulate, win_rates

SM2, FSRS = SCHEDULERS


def test_same_seed_gives_the_same_histories():
    assert simulate(7, 50) == simulate(7, 50)
    assert simulate(7, 50) != simulate(8, 50)


def test_generates_at_least_the_requested_repeat_reviews():
    hist = simulate(0, 50)
    assert sum(len(h) - 1 for h in hist) >= 50


def test_reviews_follow_sm2_due_dates_or_later():
    for h in simulate(1, 200):
        state = None
        for prev, nxt in zip(h, h[1:]):
            state = SM2.update(state, SM2.rate(prev.solved, prev.confidence, prev.used_hint), prev.attempted_on)
            assert nxt.attempted_on >= state.due_on


def test_fsrs_wins_when_the_truth_is_fsrs():
    hist = simulate(0, 2000)
    losses = {s.name: score(predictions(hist, s)).log_loss for s in SCHEDULERS}
    assert losses["FSRS"] < losses["SM-2"]


def test_mean_predicted_matches_the_true_mean_when_the_model_is_right():
    hist = simulate(0, 2000)
    true_mean = sum(a.true_recall for h in hist for a in h[1:]) / sum(len(h) - 1 for h in hist)
    s = score(predictions(hist, FSRS))
    assert s.mean_predicted == pytest.approx(true_mean)
    # Outcomes are coin flips around the true recall, so only close.
    assert s.mean_actual == pytest.approx(true_mean, abs=0.02)


def test_a_faster_forgetter_solves_less_often():
    def solve_rate(scale: float) -> float:
        repeats = [a for h in simulate(0, 2000, stability_scale=scale) for a in h[1:]]
        return sum(a.solved for a in repeats) / len(repeats)

    assert solve_rate(0.25) < solve_rate(1.0) - 0.05


def test_win_rates_split_every_trial_between_the_schedulers():
    rates = win_rates(reviews=50, trials=10)
    assert set(rates) == {"SM-2", "FSRS"}
    assert sum(rates.values()) == pytest.approx(1)
