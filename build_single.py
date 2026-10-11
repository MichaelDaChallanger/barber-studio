#!/usr/bin/env python3
"""Zloží projekt do jedného súboru dist/barber-studio.html (formát pre Artifact:
bez <!doctype>/<html>/<head>/<body>, CSS a JS vložené priamo)."""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
read = lambda p: (root / p).read_text(encoding="utf-8")

html = read("index.html")
body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
body = re.sub(r"\s*<script src=\"js/[^\"]+\"></script>", "", body)
fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', html).group(1)

css = read("css/styles.css")
scripts = "\n".join(read(f"js/{n}.js") for n in ("data", "booking-logic", "storage", "app"))
assert "</script" not in scripts.lower()

out = f"""<title>Barber Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
:root {{ color-scheme: dark; }}
{css}
</style>
<div id="top"></div>
{body.strip()}
<script>
{scripts}
</script>
"""
(root / "dist").mkdir(exist_ok=True)
(root / "dist" / "barber-studio.html").write_text(out, encoding="utf-8")
print("dist/barber-studio.html", len(out.encode()) // 1024, "kB")
