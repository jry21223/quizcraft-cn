#!/bin/bash

# 刷题系统启动脚本

echo "🚀 启动刷题系统..."

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要安装 Python 3"
    exit 1
fi

# 安装依赖
echo "📦 检查依赖..."
pip install -q -r requirements.txt

# 启动后端
echo "🔧 启动后端服务..."
python3 server.py &
SERVER_PID=$!

# 等待后端启动
sleep 2

# 启动前端
echo "🌐 启动前端..."
cd web-app

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

npm run dev &
CLIENT_PID=$!

echo ""
echo "✅ 刷题系统已启动！"
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:10086"
echo "   API文档: http://localhost:10086/docs"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待中断
trap "kill $SERVER_PID $CLIENT_PID; exit" INT
wait
