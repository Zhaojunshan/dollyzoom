#!/usr/bin/env python3
"""Fix static-export URLs for nested pages.

The Pages build uses a relative `_next` prefix so the site root works both at
https://dollyzoom.top/ and on a github.io project path. Nested HTML such as
terms/index.html must point one directory up, or its CSS and JS 404.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"


def main() -> None:
    if not OUT.is_dir():
        raise SystemExit("out/ is missing. Run npm run build first.")
    for path in OUT.rglob("*.html"):
        depth = len(path.relative_to(OUT).parts) - 1
        prefix = "./" if depth == 0 else "../" * depth
        text = path.read_text()
        updated = text.replace('"/favicon.ico', f'"{prefix}favicon.ico')
        if depth:
            updated = updated.replace('"./_next/', f'"{prefix}_next/')
        if updated != text:
            path.write_text(updated)
            print(f"relativized {path.relative_to(ROOT)} (depth {depth})")


if __name__ == "__main__":
    main()
