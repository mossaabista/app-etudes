#!/bin/bash
# generate.sh <out-file> <seed> <prompt> — render one widget with FLUX.1-schnell (Apache-2.0,
# commercial use allowed) through its public Hugging Face Space. The subject of each widget
# and the style appended to every prompt are in prompts.txt.
# One request at a time: the anonymous GPU quota rejects concurrent calls.
B=${FLUX_SPACE:-https://black-forest-labs-flux-1-schnell.hf.space}
OUT=$1; SEED=$2; P=$3
BODY=$(python3 -c "import json,sys; print(json.dumps({'data':[sys.argv[1],int(sys.argv[2]),False,1024,1024,4]}))" "$P" "$SEED")
for try in 1 2 3 4; do
  ID=$(curl -s -X POST "$B/gradio_api/call/infer" -H "Content-Type: application/json" -d "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('event_id',''))" 2>/dev/null)
  RESP=$(curl -s -N --max-time 300 "$B/gradio_api/call/infer/$ID")
  URL=$(echo "$RESP" | grep '^data: \[{' | head -1 | python3 -c "import sys,json; d=sys.stdin.read(); print(json.loads(d[6:])[0]['url'] if d else '')" 2>/dev/null)
  if [ -n "$URL" ]; then curl -s -o "$OUT" "$URL" && echo "OK $OUT"; exit 0; fi
  echo "retry $try $OUT: $(echo "$RESP" | tail -1 | cut -c1-160)" >&2
  sleep $((try * 20))
done
echo "FAIL $OUT"; exit 1
