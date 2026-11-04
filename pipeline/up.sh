#!/bin/sh
# Ensure Xvfb :99 and the Next dev server on 127.0.0.1:5176 are running.
pgrep -x Xvfb >/dev/null || (nohup Xvfb :99 -screen 0 1920x1080x24 >/dev/null 2>&1 &)
if ! curl -s -o /dev/null --max-time 5 http://127.0.0.1:5176/; then
  cd /home/user/grasscn/apps/web && BUN_OPTIONS="--smol" nohup bun --bun next dev --webpack --hostname 127.0.0.1 --port 5176 > /tmp/claude-0/-home-user-grasscn/af7d1b75-ebb3-5e26-8f14-cce022af46f2/scratchpad/dev.log 2>&1 &
  for i in $(seq 1 80); do curl -s -o /dev/null --max-time 120 http://127.0.0.1:5176/launch-video && break; sleep 3; done
fi
curl -s -o /dev/null -w "server %{http_code}\n" --max-time 200 http://127.0.0.1:5176/launch-video
