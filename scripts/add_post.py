#!/usr/bin/env python3
"""Add one or more X / LinkedIn post URLs to posts.json (deduplicated, newest kept first).

Usage: python3 scripts/add_post.py [--repost] [--pin] <url> [<url> ...]

  --repost  mark the post(s) as reposted by me (shows a "Reposted by me" label)
  --pin     keep the post(s) at the front regardless of date
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "posts.json"

PATTERNS = [
    re.compile(r"^https?://(?:www\.|mobile\.)?(?:x|twitter)\.com/[A-Za-z0-9_]+/status(?:es)?/\d+"),
    re.compile(r"^https?://(?:[a-z]{2,3}\.)?linkedin\.com/.*urn:li:(?:activity|share|ugcPost):\d+"),
    re.compile(r"^https?://(?:[a-z]{2,3}\.)?linkedin\.com/posts/.*-(?:activity|ugcPost|share)-\d+"),
]


def entry_url(entry) -> str:
    return entry["url"] if isinstance(entry, dict) else entry


def post_key(url: str) -> str:
    m = re.search(r"(\d{15,})", url)
    return m.group(1) if m else url


def clean(url: str) -> str:
    url = url.strip()
    # Drop tracking query strings; keep the path (LinkedIn URNs live in the path).
    return url.split("?", 1)[0] if "urn:li:" not in url else url


def main(argv):
    flags = {a for a in argv[1:] if a.startswith("--")}
    urls = [a for a in argv[1:] if not a.startswith("--")]
    unknown = flags - {"--repost", "--pin"}
    if unknown or not urls:
        print(__doc__)
        return 2
    posts = json.loads(POSTS.read_text()) if POSTS.exists() else []
    known = {post_key(entry_url(e)) for e in posts}
    added = []
    for raw in urls:
        url = clean(raw)
        if not any(p.match(url) for p in PATTERNS):
            print(f"skip (not an X / LinkedIn post URL): {raw}", file=sys.stderr)
            continue
        if post_key(url) in known:
            print(f"skip (already listed): {url}")
            continue
        known.add(post_key(url))
        entry = {"url": url}
        if "--repost" in flags:
            entry["repost"] = True
        if "--pin" in flags:
            entry["pin"] = True
        added.append(entry if len(entry) > 1 else url)
    if added:
        posts = added + posts
        POSTS.write_text(json.dumps(posts, indent=2, ensure_ascii=False) + "\n")
        for e in added:
            print(f"added: {entry_url(e)}")
    return 0 if added else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
