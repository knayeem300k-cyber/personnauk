#!/bin/bash
# Double-click this file to copy the latest project files here and send them to GitHub.
cd "$(dirname "$0")" || exit 1
SRC=".."
if [ ! -f "$SRC/index.html" ] || [ ! -d "$SRC/css" ] || [ ! -d "$SRC/js" ]; then
  echo "Could not find index.html, css and js in the project folder."; read -r -p "Press Enter to close…"; exit 1
fi
echo "Copying the latest files…"
cp "$SRC/index.html" index.html
rsync -a --delete "$SRC/css/" css/
rsync -a --delete "$SRC/js/" js/
# Build on top of whatever is on GitHub now, so the push is never rejected.
# This project folder is the master copy: anything changed on the GitHub website is replaced.
if git fetch -q origin main 2>/dev/null; then git reset -q --soft origin/main; fi
git add -A
if git diff --cached --quiet; then
  echo "Nothing has changed since the last upload."
else
  git commit -q -m "Update $(date '+%Y-%m-%d %H:%M')" && echo "Saved a new version."
fi
echo "Sending to GitHub…"
if git push -u origin main; then echo; echo "Done. GitHub is up to date."; else echo; echo "Upload failed. Check your internet and GitHub login (token)."; fi
read -r -p "Press Enter to close…"
