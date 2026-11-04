#!/bin/sh
export MC_BUNDLE=/tmp/claude-0/-home-user-grasscn/af7d1b75-ebb3-5e26-8f14-cce022af46f2/scratchpad/game-dl/x/minecraft-26.2-linux-x64 DISPLAY=:99 LIBGL_ALWAYS_SOFTWARE=1 JAVA=/usr/lib/jvm/java-25-openjdk-amd64/bin/java MC_MAX_HEAP=3G MC_USERNAME=Player MC_UUID=00000000000000000000000000000001 MC_ACCESS_TOKEN=0
unset JAVA_TOOL_OPTIONS
cd /tmp/claude-0/-home-user-grasscn/af7d1b75-ebb3-5e26-8f14-cce022af46f2/scratchpad/launch/recorder
for m in ${MODES:-title panorama}; do VIDEO_OPTS="-Dvideo.mode=$m -Dvideo.start=${START:-0} -Dvideo.frames=${FRAMES:-600} -Dvideo.out=/tmp/claude-0/-home-user-grasscn/af7d1b75-ebb3-5e26-8f14-cce022af46f2/scratchpad/launch/recorder/frames/$m" timeout 3000 python3 record.py --width 1920 --height 1080 > rec-$m.log 2>&1; grep -ao "VIDEO_RECORD_COMPLETE[^]]*" rec-$m.log; done
