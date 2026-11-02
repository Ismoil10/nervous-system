#!/bin/bash
cd /c/Users/User/projects/galaxy
SCR="$1"
: > "$SCR/retry.log"
while read -r t; do
  [ -z "$t" ] && continue
  ok=0
  for attempt in 1 2 3 4 5; do
    out=$(PYTHONIOENCODING=utf-8 graphify add "https://en.wikipedia.org/api/rest_v1/page/html/$t" --dir brain-system/raw --contributor "Claude" 2>&1)
    if echo "$out" | grep -q "Saved to"; then ok=1; break; fi
    if echo "$out" | grep -q "429"; then sleep $((20 * attempt)); else echo "$t | $(echo "$out" | grep -iE "error" | head -1)" >> "$SCR/retry.log"; break; fi
  done
  [ $ok = 1 ] && echo "$t | ok" >> "$SCR/retry.log" || echo "$t | FAILED" >> "$SCR/retry.log"
  sleep 4
done < "$SCR/retry_topics.txt"
echo DONE >> "$SCR/retry.log"
