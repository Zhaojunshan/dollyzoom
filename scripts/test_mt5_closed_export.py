import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("mt5_closed_export", Path(__file__).with_name("mt5_closed_export.py"))
EXPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPORT)


class ExportTests(unittest.TestCase):
    def test_overview_drops_login_and_marks_the_file_local(self):
        class Info:
            trade_mode = 0
            balance = 1000
            equity = 1100
            currency = "USD"
            login = 99887766
            server = "Broker-Demo"
            password = "not-used"

        deals = json.loads((ROOT / "fixtures" / "partial-closes.json").read_text(encoding="utf-8"))["deals"]
        overview = EXPORT.overview_from_info(Info(), "2026-11-24T00:00:00Z")
        document = EXPORT.build_export(
            deals,
            overview=overview,
            timezone_name="Asia/Shanghai",
            now_iso="2026-11-24T00:00:00Z",
        )
        encoded = json.dumps(document)
        self.assertNotIn("99887766", encoded)
        self.assertNotIn("Broker-Demo", encoded)
        self.assertNotIn("not-used", encoded)
        self.assertNotIn("ticket-should-not-leak", encoded)
        self.assertTrue(document["localOnly"])
        self.assertFalse(document["account"]["verified"])
        self.assertEqual(document["account"]["class"], "demo")
        self.assertEqual(document["overview"]["balance"], 1000)
        self.assertEqual(document["overview"]["equity"], 1100)
        self.assertEqual(document["equitySnapshots"], [])
        self.assertIsNone(document["startingBalance"])
        self.assertEqual(len(document["closedTrades"]), 2)

    def test_live_mode_is_not_marked_verified(self):
        class Info:
            trade_mode = 2
            balance = 1
            equity = 1
            currency = "EUR"
            login = 1

        overview = EXPORT.overview_from_info(Info(), "2026-11-24T00:00:00Z")
        self.assertEqual(overview["class"], "live")
        self.assertFalse(overview["verified"])
        self.assertNotIn("login", overview)

    def test_cli_refuses_credentials_and_unattended_terminal_reads(self):
        with self.assertRaises(SystemExit):
            EXPORT.main(["--password", "secret"])
        with self.assertRaises(SystemExit):
            EXPORT.main(["--include-current-overview"])


if __name__ == "__main__":
    unittest.main()
