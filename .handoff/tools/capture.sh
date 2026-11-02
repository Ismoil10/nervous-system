#!/bin/bash
cd /c/Users/User/projects/galaxy
SCR="$1"
: > "$SCR/capture.log"
while read -r t; do
  [ -z "$t" ] && continue
  out=$(PYTHONIOENCODING=utf-8 graphify add "https://en.wikipedia.org/api/rest_v1/page/html/$t" --dir brain-system/raw --contributor "Claude" 2>&1 | grep -E "Saved to|rror|ail" | head -2)
  echo "$t | $out" >> "$SCR/capture.log"
done < "$SCR/body_topics.txt"
echo DONE >> "$SCR/capture.log"
