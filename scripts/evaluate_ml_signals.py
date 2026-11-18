#!/usr/bin/env python3
"""Evaluate archived ML signals against later MT5 OHLC bars (not a model trainer)."""

import argparse
import bisect
import csv
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: float
    close: float
    spread_points: float
    point_size: float
    symbol: str = ""


@dataclass(frozen=True)
class Signal:
    signal_id: str
    signal_time: datetime
    training_data_through: datetime
    model_id: str
    model_version: str
    symbol: str
    timeframe: str
    direction: str
    confidence: float


@dataclass(frozen=True)
class Trade:
    signal: Signal
    entry_index: int
    exit_index: int
    net_return: float


def parse_time(value: str, field: str) -> datetime:
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as error:
        raise ValueError(f"Invalid {field} timestamp {value!r}") from error
    if parsed.tzinfo is None:
        raise ValueError(f"{field} must include a timezone (UTC expected)")
    return parsed.astimezone(timezone.utc)


def read_bars(path: Path, spread_fallback: Optional[float]) -> list[Bar]:
    bars: list[Bar] = []
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {"timestamp_utc", "symbol", "open", "close", "point_size"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"Market CSV must include columns: {', '.join(sorted(required))}")

        has_spread = "spread_points" in reader.fieldnames
        if not has_spread and spread_fallback is None:
            raise ValueError("Market CSV has no spread_points column; supply --spread-points")

        for line, row in enumerate(reader, 2):
            try:
                stamp = parse_time(row["timestamp_utc"], f"market row {line}")
                open_price = float(row["open"])
                close_price = float(row["close"])
                point_size = float(row["point_size"])
                symbol = row["symbol"].strip()
                spread = float(row["spread_points"]) if has_spread and row["spread_points"] else 0.0
                if spread <= 0 and spread_fallback is not None:
                    spread = spread_fallback
                if (
                    not all(math.isfinite(x) for x in (open_price, close_price, point_size, spread))
                    or open_price <= 0
                    or close_price <= 0
                    or point_size <= 0
                    or spread <= 0
                    or not symbol
                ):
                    raise ValueError("symbol, prices, point size, and spread must be valid")
                if bars and symbol != bars[0].symbol:
                    raise ValueError("the market CSV must contain only one symbol")
                if bars and stamp <= bars[-1].timestamp:
                    raise ValueError("timestamps must be strictly increasing without duplicates")
                bars.append(Bar(stamp, open_price, close_price, spread, point_size, symbol))
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"{path}:{line}: {error}") from error

    if len(bars) < 2:
        raise ValueError("At least two valid market bars are required")
    return bars


def read_signals(path: Path) -> list[Signal]:
    signals: list[Signal] = []
    seen_ids: set[str] = set()
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {
            "signalId",
            "signalTime",
            "trainingDataThrough",
            "modelId",
            "modelVersion",
            "symbol",
            "timeframe",
            "signal",
            "confidence",
        }
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"Signal CSV must include columns: {', '.join(sorted(required))}")

        for line, row in enumerate(reader, 2):
            try:
                signal_id = row["signalId"].strip()
                if not signal_id or signal_id in seen_ids:
                    continue
                seen_ids.add(signal_id)
                direction = row["signal"].strip()
                confidence = float(row["confidence"])
                signal_time = parse_time(row["signalTime"], f"signal row {line}")
                training_cutoff = parse_time(
                    row["trainingDataThrough"], f"training cutoff row {line}"
                )
                if direction not in {"Buy", "Sell", "Hold"}:
                    raise ValueError("signal must be Buy, Sell, or Hold")
                if not math.isfinite(confidence) or not 0 <= confidence <= 100:
                    raise ValueError("confidence must be between 0 and 100")
                if training_cutoff >= signal_time:
                    raise ValueError("signalTime must be later than trainingDataThrough")
                signals.append(
                    Signal(
                        signal_id=signal_id,
                        signal_time=signal_time,
                        training_data_through=training_cutoff,
                        model_id=row["modelId"].strip(),
                        model_version=row["modelVersion"].strip(),
                        symbol=row["symbol"].strip(),
                        timeframe=row["timeframe"].strip(),
                        direction=direction,
                        confidence=confidence,
                    )
                )
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"{path}:{line}: {error}") from error

    signals.sort(key=lambda signal: signal.signal_time)
    return signals


def summarize(trades: list[Trade], candidate_count: int) -> dict:
    returns = [trade.net_return for trade in trades]
    wins = [value for value in returns if value > 0]
    losses = [value for value in returns if value < 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    average_win = sum(wins) / len(wins) if wins else 0.0
    average_loss = sum(losses) / len(losses) if losses else 0.0
    break_even = (
        abs(average_loss) / (average_win + abs(average_loss)) * 100
        if average_win > 0 and average_loss < 0
        else None
    )

    equity = peak = max_drawdown = 0.0
    for value in returns:
        equity += value
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, peak - equity)

    brier_score = (
        sum(
            (trade.signal.confidence / 100 - (1 if trade.net_return > 0 else 0)) ** 2
            for trade in trades
        ) / len(trades)
        if trades
        else None
    )

    return {
        "candidate_signals": candidate_count,
        "executed_trades": len(trades),
        "skipped_for_overlap_or_missing_bars": candidate_count - len(trades),
        "win_rate_pct": len(wins) / len(trades) * 100 if trades else None,
        "average_win_bps": average_win * 10000 if wins else None,
        "average_loss_bps": average_loss * 10000 if losses else None,
        "expectancy_bps_per_trade": sum(returns) / len(returns) * 10000 if trades else None,
        "profit_factor": gross_profit / gross_loss if gross_loss > 0 else None,
        "break_even_win_rate_pct_from_sample": break_even,
        "max_drawdown_bps_equal_notional": max_drawdown * 10000,
        "brier_score_confidence_vs_net_win": brier_score,
    }


def evaluate_threshold(
    signals: list[Signal],
    bars: list[Bar],
    bar_times: list[datetime],
    holding_bars: int,
    threshold: float,
    slippage_points: float,
    commission_bps_per_side: float,
    spread_multiplier: float,
) -> tuple[list[Trade], int]:
    candidates = [
        signal
        for signal in signals
        if signal.direction != "Hold" and signal.confidence >= threshold
    ]
    trades: list[Trade] = []
    next_available_index = 0

    for signal in candidates:
        entry_index = bisect.bisect_left(bar_times, signal.signal_time)
        exit_index = entry_index + holding_bars - 1
        if entry_index < next_available_index or exit_index >= len(bars):
            continue

        entry = bars[entry_index]
        exit_bar = bars[exit_index]
        spread_cost = (
            entry.spread_points * spread_multiplier * entry.point_size
            if signal.direction == "Buy"
            else exit_bar.spread_points * spread_multiplier * exit_bar.point_size
        )
        slippage_cost = (
            slippage_points * entry.point_size
            + slippage_points * exit_bar.point_size
        )
        commission_cost = (2 * commission_bps_per_side) / 10000 * entry.open
        direction = 1 if signal.direction == "Buy" else -1
        gross_pnl = direction * (exit_bar.close - entry.open)
        cost = spread_cost + slippage_cost + commission_cost
        net_return = (gross_pnl - cost) / entry.open

        trades.append(Trade(signal, entry_index, exit_index, net_return))
        next_available_index = exit_index + 1

    return trades, len(candidates)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--signals", required=True, type=Path, help="CSV downloaded from /api/ml-signals")
    parser.add_argument("--market", required=True, type=Path, help="MT5 H1 market CSV")
    parser.add_argument("--holding-bars", type=int, default=4, help="Hold for N bars (default: 4)")
    parser.add_argument(
        "--confidence-thresholds",
        default="0,50,60,70,80,90",
        help="Comma-separated thresholds on the 0-100 model confidence scale",
    )
    parser.add_argument(
        "--spread-points",
        type=float,
        help="Fallback spread when a market bar has zero/missing spread",
    )
    parser.add_argument(
        "--spread-multiplier",
        type=float,
        default=1.0,
        help="Scale observed/fallback spread for cost sensitivity (default: 1.0)",
    )
    parser.add_argument(
        "--slippage-points-per-side",
        type=float,
        default=1.0,
        help="Assumed slippage per side in broker points (default: 1.0)",
    )
    parser.add_argument(
        "--commission-bps-per-side",
        type=float,
        default=0.0,
        help="Approximate commission per side as basis points of notional (default: 0)",
    )
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    args = parser.parse_args()

    if args.holding_bars < 1:
        parser.error("--holding-bars must be at least 1")
    for name in ("spread_multiplier", "slippage_points_per_side", "commission_bps_per_side"):
        value = getattr(args, name)
        if not math.isfinite(value) or value < 0:
            parser.error(f"--{name.replace('_', '-')} must be finite and non-negative")
    if args.spread_points is not None and (
        not math.isfinite(args.spread_points) or args.spread_points <= 0
    ):
        parser.error("--spread-points must be finite and positive")

    try:
        thresholds = [float(value) for value in args.confidence_thresholds.split(",")]
        if not thresholds or any(not math.isfinite(x) or x < 0 or x > 100 for x in thresholds):
            raise ValueError("thresholds must be between 0 and 100")
        if len(set(thresholds)) != len(thresholds):
            raise ValueError("thresholds must be unique")

        bars = read_bars(args.market, args.spread_points)
        signals = read_signals(args.signals)
        if not signals:
            raise ValueError("No unique model signals found")
        if not any(signal.direction != "Hold" for signal in signals):
            raise ValueError("No Buy or Sell signals found")
        bar_times = [bar.timestamp for bar in bars]

        models = sorted({(signal.model_id, signal.model_version) for signal in signals})
        symbols = sorted({signal.symbol for signal in signals})
        timeframes = sorted({signal.timeframe for signal in signals})
        if len(models) != 1:
            raise ValueError("Filter the signal export to a single modelId/modelVersion before evaluation")
        if len(symbols) != 1 or len(timeframes) != 1:
            raise ValueError("Evaluate one symbol and timeframe at a time")
        market_symbols = {bar.symbol for bar in bars}
        if market_symbols != set(symbols):
            raise ValueError(
                f"Signal symbol {symbols[0]!r} does not match MT5 market symbol "
                f"{next(iter(market_symbols))!r}; use the exact broker symbol alias in both files"
            )

        evaluated = [
            signal
            for signal in signals
            if signal.signal_time >= bars[0].timestamp
            and signal.signal_time < bars[-1].timestamp
            and signal.training_data_through < signal.signal_time
        ]
        if not evaluated:
            raise ValueError("No signals fall within the market-data range")

        results = {}
        for threshold in sorted(thresholds):
            trades, candidates = evaluate_threshold(
                evaluated,
                bars,
                bar_times,
                args.holding_bars,
                threshold,
                args.slippage_points_per_side,
                args.commission_bps_per_side,
                args.spread_multiplier,
            )
            results[format(threshold, "g")] = summarize(trades, candidates)

        report = {
            "evaluation": "historical archived predictions; not a trained model or profitability guarantee",
            "model_id": models[0][0],
            "model_version": models[0][1],
            "symbol": symbols[0],
            "timeframe": timeframes[0],
            "market_bars": len(bars),
            "unique_signals": len(signals),
            "signals_in_market_range": len(evaluated),
            "holding_bars": args.holding_bars,
            "execution_assumption": (
                "Enter at the first bar open at/after signalTime; exit at close after holdingBars; "
                "one position at a time; ignore Hold signals."
            ),
            "cost_assumptions": {
                "spread_source": "bar spread_points" + (" with fallback" if args.spread_points else ""),
                "spread_multiplier": args.spread_multiplier,
                "slippage_points_per_side": args.slippage_points_per_side,
                "commission_bps_per_side": args.commission_bps_per_side,
                "ohlc_assumption": "MT5 bid OHLC; Buy pays entry spread, Sell pays exit spread",
            },
            "confidence_threshold_results": results,
            "limitations": [
                "Use only predictions generated without access to their future outcomes; training cutoffs alone cannot prove no leakage.",
                "The fixed holding-period test does not model stop-losses, take-profits, gaps, rejected orders, financing, or position sizing.",
                "Costs and sequential equal-notional drawdown are simplified; validate candidates on a separate forward period.",
                "Confidence threshold comparisons are exploratory and must not be tuned and reported on the same holdout set.",
            ],
        }
        text = json.dumps(report, indent=2, allow_nan=False)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(text + "\n", encoding="utf-8")
            print(f"Wrote report to {args.output.resolve()}")
        else:
            print(text)
        return 0
    except (OSError, ValueError) as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
