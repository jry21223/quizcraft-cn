#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-10086}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
WAIT_HOST="${WAIT_HOST:-127.0.0.1}"
SERVER_PID=""
CLIENT_PID=""

stop_port() {
  local port="$1"
  local pid
  pid=$(lsof -tiTCP:"${port}" -sTCP:LISTEN | head -n1 || true)
  if [ -n "${pid}" ]; then
    echo "⚠️ 端口 ${port} 已被占用，停止进程 ${pid}"
    kill "${pid}" || true
    sleep 1
  fi
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local retries="${3:-30}"
  local i
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "✓ ${name}已就绪: ${url}"
      return 0
    fi
    sleep 1
  done
  echo "❌ ${name}启动失败: ${url}"
  return 1
}

cleanup() {
  if [ -n "${SERVER_PID}" ]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  if [ -n "${CLIENT_PID}" ]; then
    kill "${CLIENT_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "🚀 启动刷题系统..."

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要安装 Python 3"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 需要安装 Node.js 和 npm"
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "❌ 需要安装 lsof"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ 需要安装 curl"
  exit 1
fi

if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "❌ 当前 Python 3 环境缺少 pip"
  exit 1
fi

echo "📦 检查后端依赖..."
python3 -m pip install -q -r requirements.txt

stop_port "${BACKEND_PORT}"
stop_port "${FRONTEND_PORT}"

echo "🔧 启动后端服务..."
APP_HOST="${BACKEND_HOST}" APP_PORT="${BACKEND_PORT}" python3 server.py > server.log 2>&1 &
SERVER_PID=$!
wait_for_url "后端" "http://${WAIT_HOST}:${BACKEND_PORT}/api/banks"

echo "🌐 启动前端..."
cd web-app
if [ ! -x "node_modules/.bin/vite" ]; then
  echo "📦 安装前端依赖..."
  npm install --include=dev
fi

npm run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" > dev.log 2>&1 &
CLIENT_PID=$!
wait_for_url "前端" "http://${WAIT_HOST}:${FRONTEND_PORT}/"

echo ""
echo "✅ 刷题系统已启动！"
echo "   前端: http://${WAIT_HOST}:${FRONTEND_PORT}"
echo "   后端: http://${WAIT_HOST}:${BACKEND_PORT}"
echo "   API文档: http://${WAIT_HOST}:${BACKEND_PORT}/docs"
echo ""
echo "按 Ctrl+C 停止服务"
wait
