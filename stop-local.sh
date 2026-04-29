#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
FRONT_PID_FILE="$RUN_DIR/frontend.pid"
BACK_PID_FILE="$RUN_DIR/backend.pid"

stop_one() {
  local name="$1"
  local pid_file="$2"

  if [ ! -f "$pid_file" ]; then
    echo "[信息] $name 没有 PID 文件，跳过。"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "[停止] $name 已停止，PID=$pid"
  else
    echo "[信息] $name 进程已不存在，PID=$pid"
  fi

  rm -f "$pid_file"
}

stop_one "前端" "$FRONT_PID_FILE"
stop_one "后端" "$BACK_PID_FILE"
