#!/usr/bin/env python3
"""
MOA Village — hourly trending ornament pipeline.

Runs from GitHub Actions every hour (see .github/workflows/hourly-trends.yml).
Writes data/trending-items.json, which the app reads at load time and uses for
the "지금 유행 / Trending now" strip and shop ordering.

How the ranking is built
  1) Public trend feeds are read with no API key:
       - Google Trends daily RSS  https://trends.google.com/trending/rss?geo=KR
       - Google Trends daily RSS  https://trends.google.com/trending/rss?geo=US
     Each feed title becomes a keyword.
  2) Keywords are matched against KEYWORDS (word -> ornament id). Matches add
     points to that ornament.
  3) Whatever slots stay empty are filled by a deterministic rotation seeded
     with the current hour, so the strip still changes every hour when the
     feeds are unreachable (offline runner, rate limit, changed feed format).

Only the Python standard library is used, so the workflow needs no pip install.
"""

from __future__ import annotations

import hashlib
import json
import random
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "trending-items.json"
KST = timezone(timedelta(hours=9))

# ornaments that can be featured (id must exist in assets/js/catalog.js)
ITEMS = [
    "pine", "snowman", "lamp", "gift", "bell", "star", "mushroom", "flower",
    "bench", "flag", "candy", "boot", "fence", "well", "crystal", "wreath",
    "snowglobe", "carousel", "windmill", "fox", "deer", "kite", "gate",
    "aurora", "gbell",
]

# word (lower-case, substring match) -> ornaments it suggests
KEYWORDS = {
    # winter / holiday
    "크리스마스": ["wreath", "candy", "gbell", "snowglobe"],
    "christmas": ["wreath", "candy", "gbell", "snowglobe"],
    "산타": ["gift", "bell", "snowman"],
    "santa": ["gift", "bell", "snowman"],
    "눈": ["snowman", "snowglobe", "crystal"],
    "snow": ["snowman", "snowglobe", "crystal"],
    "겨울": ["wreath", "boot", "candy"],
    "winter": ["wreath", "boot", "candy"],
    "트리": ["pine", "star", "gbell"],
    "tree": ["pine", "star"],
    # sky / night
    "오로라": ["aurora", "crystal", "deer"],
    "aurora": ["aurora", "crystal", "deer"],
    "별": ["star", "deer", "kite"],
    "star": ["star", "deer", "kite"],
    "달": ["gate", "lamp", "aurora"],
    "moon": ["gate", "lamp", "aurora"],
    "밤": ["lamp", "gate", "aurora"],
    "night": ["lamp", "gate", "aurora"],
    # creatures
    "여우": ["fox"],
    "fox": ["fox"],
    "사슴": ["deer"],
    "deer": ["deer"],
    "고양이": ["lamp", "bench"],
    "cat": ["bench", "lamp"],
    "강아지": ["bench", "flag"],
    "dog": ["bench", "flag"],
    # places / cozy
    "회전목마": ["carousel"],
    "carousel": ["carousel"],
    "풍차": ["windmill"],
    "windmill": ["windmill"],
    "바다": ["flag", "lamp", "bench"],
    "sea": ["flag", "lamp", "bench"],
    "beach": ["flag", "lamp", "bench"],
    "카페": ["bench", "lamp", "flower"],
    "cafe": ["bench", "lamp", "flower"],
    "정원": ["flower", "fountain" if "fountain" in ITEMS else "well", "mushroom"],
    "garden": ["flower", "well", "mushroom"],
    "꽃": ["flower", "mushroom"],
    "flower": ["flower", "mushroom"],
    "비": ["well", "boot", "mushroom"],
    "rain": ["well", "boot", "mushroom"],
    "바람": ["kite", "windmill", "flag"],
    "wind": ["kite", "windmill", "flag"],
    "연": ["kite"],
    "kite": ["kite"],
    "선물": ["gift", "gbell", "wreath"],
    "gift": ["gift", "gbell", "wreath"],
    "벚꽃": ["flower", "deer", "bench"],
    "blossom": ["flower", "deer", "bench"],
    "spring": ["flower", "deer", "flag"],
    "봄": ["flower", "deer", "flag"],
    "여름": ["kite", "flag", "carousel"],
    "summer": ["kite", "flag", "carousel"],
    "가을": ["windmill", "mushroom", "bench"],
    "autumn": ["windmill", "mushroom", "bench"],
}

FEEDS = [
    ("KR", "https://trends.google.com/trending/rss?geo=KR"),
    ("US", "https://trends.google.com/trending/rss?geo=US"),
]


def fetch_feed(url: str, timeout: int = 12) -> list[str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; MOA-Village-Trends/1.0; +https://github.com/)",
            "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
        root = ET.fromstring(raw)
        titles = []
        for item in root.iter("item"):
            t = item.findtext("title") or ""
            if t.strip():
                titles.append(t.strip())
        return titles[:25]
    except Exception as exc:  # noqa: BLE001 - any feed failure falls back to rotation
        print(f"  ! feed failed ({url.split('?')[-1]}): {exc}", file=sys.stderr)
        return []


def match(keywords: list[str]) -> tuple[dict[str, int], list[str]]:
    scores: dict[str, int] = {}
    used: list[str] = []
    for rank, kw in enumerate(keywords):
        low = kw.lower()
        hit = False
        for needle, ids in KEYWORDS.items():
            if needle in low:
                hit = True
                for i, oid in enumerate(ids):
                    if oid not in ITEMS:
                        continue
                    scores[oid] = scores.get(oid, 0) + max(1, 6 - i) + max(0, 4 - rank // 4)
        if hit:
            used.append(kw)
    return scores, used


def rotation_seed(hour_key: str) -> list[str]:
    rnd = random.Random(int(hashlib.sha256(hour_key.encode()).hexdigest()[:12], 16))
    pool = ITEMS[:]
    rnd.shuffle(pool)
    return pool


def main() -> int:
    now = datetime.now(timezone.utc)
    hour_key = now.strftime("%Y-%m-%dT%H")

    keywords: list[str] = []
    feeds_read = 0
    for geo, url in FEEDS:
        got = fetch_feed(url)
        print(f"  · {geo}: {len(got)} trend titles")
        if got:
            feeds_read += 1
        keywords.extend(got)

    scores, used = match(keywords)
    order = rotation_seed(hour_key)

    picked: list[str] = []
    for oid in sorted(scores, key=lambda k: (-scores[k], order.index(k))):
        if oid not in picked:
            picked.append(oid)
        if len(picked) >= 4:
            break
    for oid in order:
        if len(picked) >= 6:
            break
        if oid not in picked:
            picked.append(oid)

    top = max(scores.values()) if scores else 0
    items = []
    for idx, oid in enumerate(picked[:6]):
        if oid in scores and top:
            score = 70 + round(28 * scores[oid] / top)
        else:
            score = max(55, 84 - idx * 6)
        items.append({"id": oid, "score": score, "tag": "feed" if oid in scores else "rotation"})

    payload = {
        "generated_at": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "hour_label": now.astimezone(KST).strftime("%Y-%m-%dT%H"),
        "source": "google-trends-rss+rotation" if used else "rotation",
        "feeds_read": feeds_read,
        "feed_sample": keywords[:5],
        "keywords": used[:12],
        "items": items,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} — {', '.join(i['id'] for i in items)} (keywords used: {len(used)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
