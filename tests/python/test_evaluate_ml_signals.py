import importlib.util
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "evaluate_ml_signals.py"
SPEC = importlib.util.spec_from_file_location("evaluate_ml_signals", SCRIPT)
evaluator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = evaluator
SPEC.loader.exec_module(evaluator)


class EvaluateMlSignalsTests(unittest.TestCase):
    def test_enters_on_first_bar_at_or_after_signal_and_accounts_for_costs(self):
        bars = [
            evaluator.Bar(datetime(2026, 11, 18, hour, tzinfo=timezone.utc), 100, close, 2, 0.1, "GOLD")
            for hour, close in [(10, 101), (11, 103), (12, 105)]
        ]
        signal = evaluator.Signal(
            "signal-1",
            datetime(2026, 11, 18, 11, tzinfo=timezone.utc),
            datetime(2026, 11, 17, tzinfo=timezone.utc),
            "model",
            "v1",
            "GOLD",
            "H1",
            "Buy",
            80,
        )

        trades, candidates = evaluator.evaluate_threshold(
            [signal], bars, [bar.timestamp for bar in bars], 1, 0, 0, 0, 1
        )

        self.assertEqual(candidates, 1)
        self.assertEqual(trades[0].entry_index, 1)
        self.assertAlmostEqual(trades[0].net_return, (103 - 100 - 0.2) / 100)

    def test_skips_overlapping_trades(self):
        bars = [
            evaluator.Bar(datetime(2026, 11, 18, hour, tzinfo=timezone.utc), 100, 101, 2, 0.1, "GOLD")
            for hour in range(10, 16)
        ]
        signals = [
            evaluator.Signal(
                f"signal-{hour}",
                datetime(2026, 11, 18, hour, tzinfo=timezone.utc),
                datetime(2026, 11, 17, tzinfo=timezone.utc),
                "model",
                "v1",
                "GOLD",
                "H1",
                "Buy",
                80,
            )
            for hour in (10, 11, 12)
        ]

        trades, candidates = evaluator.evaluate_threshold(
            signals, bars, [bar.timestamp for bar in bars], 2, 0, 0, 0, 1
        )

        self.assertEqual(candidates, 3)
        self.assertEqual(len(trades), 2)

    def test_reads_market_csv_with_mt5_spreads(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "market.csv"
            path.write_text(
                "timestamp_utc,symbol,open,close,spread_points,point_size\n"
                "2026-11-18T10:00:00+00:00,GOLD,100,101,2,0.1\n"
                "2026-11-18T11:00:00+00:00,GOLD,101,102,3,0.1\n",
                encoding="utf-8",
            )

            bars = evaluator.read_bars(path, None)

            self.assertEqual(len(bars), 2)
            self.assertEqual(bars[0].spread_points, 2)
            self.assertEqual(bars[0].symbol, "GOLD")


if __name__ == "__main__":
    unittest.main()
