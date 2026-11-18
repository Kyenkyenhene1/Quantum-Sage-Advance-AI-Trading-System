#!/usr/bin/env python3
"""Export broker-specific MetaTrader 5 GOLD H1 rates to CSV."""

import argparse
import csv
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import MetaTrader5 as mt5
except ImportError:
    print(
        "Missing dependency. Install the MetaTrader 5 Python package with: "
        "py -m pip install MetaTrader5",
        file=sys.stderr,
    )
    raise SystemExit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbol", default="GOLD", help="Exact symbol name in your MT5 terminal")
    parser.add_argument("--years", type=int, default=5, help="History range in years (default: 5)")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data") / "GOLD_H1.csv",
        help="Output CSV path (default: data/GOLD_H1.csv)",
    )
    args = parser.parse_args()

    if args.years < 1 or args.years > 20:
        parser.error("--years must be between 1 and 20")

    if not mt5.initialize():
        print(f"Could not connect to MetaTrader 5: {mt5.last_error()}", file=sys.stderr)
        return 1

    try:
        symbol = args.symbol.strip()
        info = mt5.symbol_info(symbol)
        if info is None:
            print(
                f"Symbol {symbol!r} is not available in this MT5 terminal. "
                "Check the broker's exact gold symbol name.",
                file=sys.stderr,
            )
            return 1
        if not mt5.symbol_select(symbol, True):
            print(f"Could not select {symbol!r}: {mt5.last_error()}", file=sys.stderr)
            return 1

        end = datetime.now(timezone.utc)
        start = end - timedelta(days=365 * args.years)
        rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_H1, start, end)
        if rates is None or len(rates) == 0:
            print(
                f"No H1 rates returned for {symbol!r}: {mt5.last_error()}. "
                "Open the symbol's H1 chart in MT5, load more history, then retry.",
                file=sys.stderr,
            )
            return 1

        args.output.parent.mkdir(parents=True, exist_ok=True)
        columns = (
            "timestamp_utc",
            "symbol",
            "open",
            "high",
            "low",
            "close",
            "tick_volume",
            "spread_points",
            "real_volume",
            "point_size",
        )
        with args.output.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=columns)
            writer.writeheader()
            for rate in rates:
                writer.writerow(
                    {
                        "timestamp_utc": datetime.fromtimestamp(
                            int(rate["time"]), tz=timezone.utc
                        ).isoformat(),
                        "symbol": symbol,
                        "open": rate["open"],
                        "high": rate["high"],
                        "low": rate["low"],
                        "close": rate["close"],
                        "tick_volume": rate["tick_volume"],
                        "spread_points": rate["spread"],
                        "real_volume": rate["real_volume"],
                        "point_size": info.point,
                    }
                )

        print(f"Exported {len(rates)} H1 bars for {symbol} to {args.output.resolve()}")
        print(f"Broker point size: {info.point}; range: {start.isoformat()} to {end.isoformat()}")
        return 0
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
