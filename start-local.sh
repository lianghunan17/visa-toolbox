#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT_DIR/license-api"
RUN_DIR="$ROOT_DIR/.run"
FRONT_LOG="$RUN_DIR/frontend.log"
BACK_LOG="$RUN_DIR/backend.log"
FRONT_PID_FILE="$RUN_DIR/frontend.pid"
BACK_PID_FILE="$RUN_DIR/backend.pid"

mkdir -p "$RUN_DIR"

if [ ! -f "$API_DIR/.env" ]; then
  echo "[错误] 还没有找到 $API_DIR/.env"
  echo "请先复制 .env.example 为 .env，并填好数据库配置。"
  exit 1
fi

ADMIN_TOKEN="$(grep '^ADMIN_BEARER_TOKEN=' "$API_DIR/.env" | cut -d'=' -f2-)"

if [ ! -d "$API_DIR/node_modules" ]; then
  echo "[信息] 正在安装 license-api 依赖..."
  (cd "$API_DIR" && npm install)
fi

if [ -f "$FRONT_PID_FILE" ] && kill -0 "$(cat "$FRONT_PID_FILE")" 2>/dev/null; then
  echo "[信息] 前端已在运行，PID=$(cat "$FRONT_PID_FILE")"
else
  echo "[启动] 前端静态服务 http://127.0.0.1:8000"
  (cd "$ROOT_DIR" && python3 -m http.server 8000 >"$FRONT_LOG" 2>&1 & echo $! >"$FRONT_PID_FILE")
fi

if [ -f "$BACK_PID_FILE" ] && kill -0 "$(cat "$BACK_PID_FILE")" 2>/dev/null; then
  echo "[信息] 后端已在运行，PID=$(cat "$BACK_PID_FILE")"
else
  echo "[启动] 后端 API http://127.0.0.1:8787"
  (cd "$API_DIR" && npm run dev >"$BACK_LOG" 2>&1 & echo $! >"$BACK_PID_FILE")
fi

sleep 1

echo
echo "已尝试启动完成："
echo "- 前端首页: http://127.0.0.1:8000/"
echo "- 评价页:   http://127.0.0.1:8000/feedback.html"
echo "- 后台本地入口: http://127.0.0.1:8000/admin.local.html"
echo "- 后端健康检查: http://127.0.0.1:8787/health"
echo "- 后端就绪检查: http://127.0.0.1:8787/ready"
echo
echo "日志文件："
echo "- 前端: $FRONT_LOG"
echo "- 后端: $BACK_LOG"
echo
if [ -n "$ADMIN_TOKEN" ]; then
  echo "后台管理员 token："
  echo "$ADMIN_TOKEN"
  echo
fi
echo "停止服务请运行："
echo "bash $ROOT_DIR/stop-local.sh"
