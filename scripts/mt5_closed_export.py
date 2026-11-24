#!/usr/bin/env python3
"""Read-only exporter for an already-open MetaTrader 5 terminal.

This file writes a local JSON snapshot of closed positions. It does not send
orders, does not change the terminal, and does not upload the file.

The public website will refuse a file while localOnly is true. After you
review it, remove that field and copy it to public/data/performance.json
yourself. There is no flag here that publishes.

Pass --i-understand-this-reads-the-open-terminal to attach to the terminal
that is already logged in. Do not pass a password, login, or server name.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VOL_EPS = 1e-8
CONSENT = "--i-understand-this-reads-the-open-terminal"

FORBIDDEN_KEYS = {
    "password",
    "login",
    "server",
    "accountnumber",
    "accountid",
    "account_number",
    "investor",
    "investorpassword",
    "session",
    "token",
    "secret",
    "apikey",
    "api_key",
    "positions",
    "openpositions",
    "open_positions",
    "orders",
    "deals",
}


def round_money(value: float) -> float:
    return round(float(value) + 1e-12, 8)


def round_vol(value: float) -> float:
    return round(float(value) + 1e-12, 8)


def warn(warnings: list[dict], code: str) -> None:
    for item in warnings:
        if item["code"] == code:
            item["count"] += 1
            return
    warnings.append({"code": code, "count": 1})


def parse_time(value) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed


def opposite(side: str) -> str | None:
    if side == "buy":
        return "sell"
    if side == "sell":
        return "buy"
    return None


def close_position(rows: list[dict], warnings: list[dict]) -> dict | None:
    if any(row.get("entry") == "inout" for row in rows):
        warn(warnings, "unsupported-inout")
        return None
    ins = [row for row in rows if row.get("entry") == "in"]
    outs = [row for row in rows if row.get("entry") in ("out", "out_by")]
    unknown = [row for row in rows if row.get("entry") not in ("in", "out", "out_by")]
    if unknown or not ins:
        warn(warnings, "ignored-deal-type")
        return None
    if not outs:
        warn(warnings, "still-open")
        return None
    symbols = {row.get("symbol") for row in rows}
    if len(symbols) != 1 or not rows[0].get("symbol"):
        warn(warnings, "mixed-symbol")
        return None
    close_side = opposite(ins[0].get("type"))
    if len({row.get("type") for row in ins}) != 1 or any(row.get("type") != close_side for row in outs):
        warn(warnings, "mixed-entry-side")
        return None

    def usable(row: dict) -> bool:
        if parse_time(row.get("time")) is None:
            return False
        try:
            volume = float(row["volume"])
            price = float(row["price"])
            profit = float(row["profit"])
            commission = float(row["commission"])
            swap = float(row["swap"])
        except (KeyError, TypeError, ValueError):
            return False
        return volume > 0 and all(map(lambda n: n == n and abs(n) != float("inf"), (price, profit, commission, swap)))

    if not all(usable(row) for row in rows):
        warn(warnings, "bad-deal")
        return None

    volume_in = round_vol(sum(float(row["volume"]) for row in ins))
    volume_out = round_vol(sum(float(row["volume"]) for row in outs))
    if volume_out + VOL_EPS < volume_in:
        warn(warnings, "still-open")
        return None
    if volume_out > volume_in + VOL_EPS:
        warn(warnings, "volume-mismatch")
        return None

    def sort_key(row: dict):
        return (parse_time(row["time"]), row["_index"])

    earliest = sorted(ins, key=sort_key)[0]
    latest = sorted(outs, key=sort_key)[-1]
    if parse_time(latest["time"]) < parse_time(earliest["time"]):
        warn(warnings, "bad-time")
        return None
    volume_for_price = sum(float(row["volume"]) for row in ins)
    open_price = sum(float(row["price"]) * float(row["volume"]) for row in ins) / volume_for_price
    close_volume = sum(float(row["volume"]) for row in outs)
    close_price = sum(float(row["price"]) * float(row["volume"]) for row in outs) / close_volume
    return {
        "symbol": rows[0]["symbol"],
        "side": earliest["type"],
        "volume": volume_in,
        "openTime": earliest["time"],
        "closeTime": latest["time"],
        "openPrice": round_money(open_price),
        "closePrice": round_money(close_price),
        "profit": round_money(sum(float(row["profit"]) for row in rows)),
        "commission": round_money(sum(float(row["commission"]) for row in rows)),
        "swap": round_money(sum(float(row["swap"]) for row in rows)),
        "partialCloses": len(outs),
        "note": "aggregated-partial-closes" if len(outs) > 1 else None,
    }


def aggregate_deals(deals: list[dict]) -> dict:
    if not isinstance(deals, list):
        raise TypeError("deals must be a list")
    warnings: list[dict] = []
    cashflows: list[dict] = []
    groups: dict[str, list[dict]] = {}
    for index, deal in enumerate(deals):
        kind = deal.get("type") if isinstance(deal, dict) else None
        if kind == "balance":
            try:
                profit = float(deal.get("profit"))
            except (TypeError, ValueError):
                warn(warnings, "bad-deal")
                continue
            if profit == 0 or profit != profit or parse_time(deal.get("time")) is None:
                warn(warnings, "ignored-zero-balance" if profit == 0 else "bad-deal")
                continue
            cashflows.append(
                {
                    "time": deal["time"],
                    "type": "deposit" if profit > 0 else "withdrawal",
                    "amount": round_money(abs(profit)),
                }
            )
            continue
        if kind == "credit":
            warn(warnings, "credit-ignored")
            continue
        if kind not in ("buy", "sell"):
            warn(warnings, "ignored-deal-type")
            continue
        position_id = deal.get("positionId")
        if position_id is None or position_id == "":
            warn(warnings, "missing-position-id")
            continue
        groups.setdefault(str(position_id), [])
        groups[str(position_id)].append({**deal, "_index": index})

    closed = []
    for rows in groups.values():
        trade = close_position(rows, warnings)
        if trade:
            closed.append(trade)
    closed.sort(key=lambda trade: (parse_time(trade["closeTime"]), trade["symbol"]))
    for index, trade in enumerate(closed, start=1):
        trade["id"] = f"closed-{index}"
    cashflows.sort(key=lambda item: parse_time(item["time"]))
    for index, cashflow in enumerate(cashflows, start=1):
        cashflow["id"] = f"cashflow-{index}"
    warnings.sort(key=lambda item: item["code"])
    return {"closedTrades": closed, "cashflows": cashflows, "warnings": warnings}


def contains_forbidden(value) -> bool:
    stack = [value]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            for key, child in current.items():
                normalized = "".join(ch for ch in str(key).lower() if ch.isalnum() or ch == "_")
                if normalized in FORBIDDEN_KEYS:
                    return True
                stack.append(child)
        elif isinstance(current, list):
            stack.extend(current)
    return False


def assert_public_safe(document: dict) -> dict:
    if contains_forbidden(document):
        raise RuntimeError("export contained a field that must not be written")
    return document


def overview_from_info(info, captured_at: str) -> dict:
    mode = int(info.trade_mode)
    account_class = {0: "demo", 1: "contest", 2: "live"}.get(mode, "unknown")
    return {
        "balance": float(info.balance),
        "equity": float(info.equity),
        "currency": str(info.currency),
        "class": account_class,
        "verified": False,
        "capturedAt": captured_at,
    }


def build_export(
    deals: list[dict],
    *,
    overview: dict | None = None,
    timezone_name: str = "UTC",
    now_iso: str,
    starting_balance: float | None = None,
    starting_balance_time: str | None = None,
    currency: str | None = None,
) -> dict:
    aggregated = aggregate_deals(deals)
    point = None
    if overview is not None:
        point = {
            "balance": overview["balance"],
            "equity": overview["equity"],
            "balanceAsOf": overview["capturedAt"],
            "equityAsOf": overview["capturedAt"],
        }
    document = {
        "schemaVersion": "1",
        "source": "manual-static-export",
        "localOnly": True,
        "asOf": now_iso,
        "timezone": timezone_name,
        "currency": overview["currency"] if overview else currency,
        "account": {
            "class": overview["class"] if overview else "unknown",
            "verified": False,
            "label": None,
        },
        "freshness": {
            "kind": "static-snapshot",
            "note": "Local file from a manual export. Not a live feed and not a forced delay. Review it and remove localOnly before publishing.",
        },
        "startingBalance": starting_balance,
        "startingBalanceTime": starting_balance_time,
        "overview": point
        or {"balance": None, "equity": None, "balanceAsOf": None, "equityAsOf": None},
        "equitySnapshots": [],
        "equitySnapshotsNote": "Deal history cannot reconstruct an equity curve. This export leaves equitySnapshots empty.",
        "cashflows": aggregated["cashflows"],
        "closedTrades": aggregated["closedTrades"],
        "warnings": aggregated["warnings"],
        "limits": [
            "closed-positions-only",
            "inout-excluded",
            "still-open-excluded",
            "no-equity-history",
            "starting-balance-not-inferred",
        ],
    }
    return assert_public_safe(document)


def iso_from_unix(timestamp: int) -> str:
    return datetime.fromtimestamp(int(timestamp), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def deal_from_terminal(deal) -> dict:
    type_name = {0: "buy", 1: "sell", 2: "balance", 3: "credit"}.get(int(deal.type), "other")
    entry_name = {0: "in", 1: "out", 2: "inout", 3: "out_by"}.get(int(deal.entry))
    position_id = int(deal.position_id)
    return {
        "positionId": None if position_id == 0 and type_name in ("balance", "credit") else str(position_id),
        "symbol": deal.symbol or "",
        "time": iso_from_unix(deal.time),
        "type": type_name,
        "entry": entry_name,
        "volume": float(deal.volume),
        "price": float(deal.price),
        "commission": float(deal.commission),
        "swap": float(deal.swap),
        "profit": float(deal.profit),
    }


def read_open_terminal(include_overview: bool, now_iso: str):
    import MetaTrader5 as mt5

    if not mt5.initialize():
        raise SystemExit(
            f"Could not attach to an already-open terminal ({mt5.last_error()}). No password was sent."
        )
    try:
        raw = mt5.history_deals_get(datetime(2000, 1, 1), datetime.now())
        if raw is None:
            raise SystemExit(f"Could not read deal history ({mt5.last_error()}).")
        deals = [deal_from_terminal(deal) for deal in raw]
        overview = None
        if include_overview:
            info = mt5.account_info()
            if info is None:
                raise SystemExit(f"Could not read the account overview ({mt5.last_error()}).")
            overview = overview_from_info(info, now_iso)
        return deals, overview
    finally:
        mt5.shutdown()


def refuse_secrets(argv: list[str]) -> None:
    for arg in argv:
        lowered = arg.lower()
        if "password" in lowered or lowered.startswith("--login") or lowered.startswith("--server"):
            raise SystemExit("Refusing to accept credentials or a server name on the command line.")


def main(argv: list[str] | None = None) -> int:
    refuse_secrets(list(sys.argv if argv is None else argv))
    parser = argparse.ArgumentParser(description="Export sanitized closed MT5 history to a local JSON file.")
    parser.add_argument("--aggregate-fixture", help="Read a local deals JSON file and print the aggregation. Does not open a terminal.")
    parser.add_argument(CONSENT, action="store_true", dest="consent")
    parser.add_argument("--include-current-overview", action="store_true", help="Include one balance and equity reading.")
    parser.add_argument("--out", default="mt5-export.local.json")
    parser.add_argument("--timezone", default="UTC")
    parser.add_argument("--currency", default=None)
    parser.add_argument("--starting-balance", type=float, default=None)
    parser.add_argument("--starting-balance-time", default=None)
    args = parser.parse_args(argv)

    if args.aggregate_fixture:
        payload = json.loads(Path(args.aggregate_fixture).read_text(encoding="utf-8"))
        json.dump(aggregate_deals(payload["deals"]), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0

    if not args.consent:
        raise SystemExit(
            "Refusing to read a terminal without "
            f"{CONSENT}. This script only reads an already-open terminal and writes a local file."
        )
    if (args.starting_balance is None) != (args.starting_balance_time is None):
        raise SystemExit("Pass both --starting-balance and --starting-balance-time, or neither. The script will not guess.")
    if args.currency and (len(args.currency) != 3 or not args.currency.isalpha()):
        raise SystemExit("Currency must be a 3-letter code.")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    deals, overview = read_open_terminal(args.include_current_overview, now_iso)
    document = build_export(
        deals,
        overview=overview,
        timezone_name=args.timezone,
        now_iso=now_iso,
        starting_balance=args.starting_balance,
        starting_balance_time=args.starting_balance_time,
        currency=args.currency.upper() if args.currency else None,
    )
    destination = Path(args.out)
    destination.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {destination} with localOnly=true. It was not uploaded. "
        "Review it, remove localOnly, then copy it to public/data/performance.json yourself if you want it public.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(0)
