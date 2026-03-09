#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PORT=10086
FRONTEND_PORT=5173
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

echo "🚀 启动运营环境（仅刷题 + 排行榜）..."

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要安装 Python 3"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 需要安装 Node.js 和 npm"
  exit 1
fi

echo "📦 检查后端依赖..."
pip install -q -r requirements.txt

stop_port "${BACKEND_PORT}"
stop_port "${FRONTEND_PORT}"

echo "🔧 启动后端服务..."
python3 server.py > server.log 2>&1 &
SERVER_PID=$!
wait_for_url "后端" "http://127.0.0.1:${BACKEND_PORT}/api/banks"

echo "🌐 构建运营版前端..."
cd web-app
if [ ! -d "node_modules" ]; then
  echo "📦 安装前端依赖..."
  npm install
fi

npm run build:ops

echo "🌍 启动运营版前端服务..."
npm run preview:ops > dev.log 2>&1 &
CLIENT_PID=$!
wait_for_url "前端" "http://127.0.0.1:${FRONTEND_PORT}/"

echo ""
echo "✅ 运营环境已启动！"
echo "   前端: http://localhost:${FRONTEND_PORT}"
echo "   后端: http://localhost:${BACKEND_PORT}"
echo "   API文档: http://localhost:${BACKEND_PORT}/docs"
echo ""
echo "界面已简化为：刷题、排行榜"
echo "按 Ctrl+C 停止服务"

trap cleanup INT TERM
wait
