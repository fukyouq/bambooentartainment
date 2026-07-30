"""Visual regression checks for the Bamboo header logo + title layout.

Captures the site header at mobile / tablet / desktop breakpoints and compares
each capture against a committed baseline PNG.

  python3 tests/visual/header_visual_regression.py            # compare
  python3 tests/visual/header_visual_regression.py --update   # rewrite baselines

Exits non-zero when any breakpoint differs by more than THRESHOLD pixels.
"""

import asyncio
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
ROOT = Path(__file__).parent
BASELINE, CURRENT, DIFF = ROOT / "baseline", ROOT / "current", ROOT / "diff"
THRESHOLD = 0.005  # max fraction of differing pixels

BREAKPOINTS = [
    ("mobile", 375, 812),
    ("tablet", 768, 1024),
    ("desktop", 1440, 900),
]
PAGES = [("home", "/"), ("news", "/news"), ("article-list", "/profile")]


async def capture(update: bool) -> list[str]:
    shots = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for name, w, h in BREAKPOINTS:
            ctx = await browser.new_context(viewport={"width": w, "height": h})
            page = await ctx.new_page()
            for page_name, path in PAGES:
                await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
                header = page.locator("header").first
                await header.wait_for(state="visible")
                out = (BASELINE if update else CURRENT) / f"{page_name}-{name}.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                await header.screenshot(path=str(out))
                shots.append(f"{page_name}-{name}")
            await ctx.close()
        await browser.close()
    return shots


def compare(shots: list[str]) -> int:
    failures = 0
    for shot in shots:
        base, cur = BASELINE / f"{shot}.png", CURRENT / f"{shot}.png"
        if not base.exists():
            print(f"MISSING BASELINE  {shot} — run with --update")
            failures += 1
            continue
        a, b = Image.open(base).convert("RGB"), Image.open(cur).convert("RGB")
        if a.size != b.size:
            print(f"FAIL  {shot}: size {a.size} -> {b.size}")
            failures += 1
            continue
        diff = ImageChops.difference(a, b)
        changed = sum(1 for px in diff.getdata() if px != (0, 0, 0))
        ratio = changed / (a.size[0] * a.size[1])
        if ratio > THRESHOLD:
            DIFF.mkdir(parents=True, exist_ok=True)
            diff.save(DIFF / f"{shot}.png")
            print(f"FAIL  {shot}: {ratio:.4%} of pixels changed")
            failures += 1
        else:
            print(f"PASS  {shot}: {ratio:.4%} drift")
    return failures


async def main() -> int:
    update = "--update" in sys.argv
    shots = await capture(update)
    if update:
        print(f"Baselines written for {len(shots)} captures.")
        return 0
    return 1 if compare(shots) else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
