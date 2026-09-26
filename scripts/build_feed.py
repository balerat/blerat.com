#!/usr/bin/env python3
"""Build feed.xml (RSS 2.0) from notes/index.json.

Run from the repo root. The deploy workflow calls this before syncing to S3.
"""

import json
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape

SITE = "https://blerat.com"
ROOT = Path(__file__).resolve().parent.parent


def rfc822(date_str):
    return format_datetime(datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc))


def main():
    notes = json.loads((ROOT / "notes" / "index.json").read_text(encoding="utf-8"))
    notes.sort(key=lambda n: n["date"], reverse=True)

    items = []
    for n in notes:
        link = f"{SITE}/pages/note.html?f={quote(n['file'])}"
        items.append(
            "    <item>\n"
            f"      <title>{escape(n['title'])}</title>\n"
            f"      <link>{escape(link)}</link>\n"
            f"      <guid>{escape(link)}</guid>\n"
            f"      <pubDate>{rfc822(n['date'])}</pubDate>\n"
            f"      <description>{escape(n.get('summary', ''))}</description>\n"
            "    </item>"
        )

    last = rfc822(notes[0]["date"]) if notes else format_datetime(datetime.now(timezone.utc))
    feed = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        "    <title>Baptiste Lerat — Blog</title>\n"
        f"    <link>{SITE}/pages/blog.html</link>\n"
        f'    <atom:link href="{SITE}/feed.xml" rel="self" type="application/rss+xml" />\n'
        "    <description>Notes on physics, cold atoms and things I build.</description>\n"
        "    <language>en</language>\n"
        f"    <lastBuildDate>{last}</lastBuildDate>\n"
        + "\n".join(items)
        + ("\n" if items else "")
        + "  </channel>\n"
        "</rss>\n"
    )
    (ROOT / "feed.xml").write_text(feed, encoding="utf-8")
    print(f"feed.xml: {len(items)} item(s)")


if __name__ == "__main__":
    main()
