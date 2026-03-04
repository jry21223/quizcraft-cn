#!/bin/bash

set -e

echo "🚀 启动运营环境（仅刷题 + 排行榜）..."

if ! command -v python3 &> /dev/null; then
  echo "❌ 需要安装 Python 3"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "❌ 需要安装 Node.js 和 npm"
  exit 1
fi

echo "📦 检查后端依赖..."
pip install -q -r requirements.txt

echo "🔧 启动后端服务..."
python3 server.py &
SERVER_PID=$!

echo "🌐 构建运营版前端..."
cd web-app

if [ ! -d "node_modules" ]; then
  echo "📦 安装前端依赖..."
  npm install
fi

npm run build:ops

echo "🌍 启动运营版前端服务..."
npm run preview:ops &
CLIENT_PID=$!

echo ""
echo "✅ 运营环境已启动！"
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:10086"
echo "   API文档: http://localhost:10086/docs"
echo ""
echo "界面已简化为：刷题、排行榜"
echo "按 Ctrl+C 停止服务"

trap "kill $SERVER_PID $CLIENT_PID; exit" INT
wait
