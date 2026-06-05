#!/bin/bash
# 确保 Node.js 后端进程在后台运行
cd /root/bus-game/server
PID_FILE=/root/bus-game/server.pid

# 检查现有进程
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Server already running with PID $OLD_PID"
    exit 0
  fi
fi

# 启动
nohup node index.js >> /root/bus-game/server.log 2>&1 &
NEW_PID=$!
echo $NEW_PID > "$PID_FILE"
echo "Server started with PID $NEW_PID"
