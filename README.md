# QuizCraft CN（刷题助手 v2.0）

GitHub 仓库：<https://github.com/jry21223/quizcraft-cn>

基于 React + TypeScript + FastAPI 重构的刷题系统，支持智能题库提取和 AI 解析生成。

## ✨ 新特性

### 前端 (React + TypeScript)
- ⚡ **现代化 UI**：流畅的动画效果和响应式设计
- 🎯 **多种练习模式**：随机、难题、章节模式
- 📊 **实时统计**：答题正确率、用时统计
- ⭐ **收藏功能**：收藏难题重点复习
- 📝 **错题本**：自动记录答错的题目
- 🎨 **主题切换**：支持不同题库的主题色

### 后端 (FastAPI)
- 🚀 **高性能**：基于 FastAPI 的异步处理
- 📚 **多格式支持**：兼容新旧题库格式
- 🔧 **自动转换**：自动将旧格式转换为新标准
- 💾 **数据持久化**：排行榜和用户数据本地存储

### 题库提取工具
- 📄 **多格式导入**：支持 PDF、Word、TXT
- 🤖 **AI 解析**：使用 OpenAI/DeepSeek 生成答案解析
- ✏️ **可视化编辑**：提取后可编辑题目内容
- 💾 **一键导出**：导出为标准 JSON 格式

## 🚀 快速开始

### 1. 安装依赖

```bash
# 后端依赖
python3 -m pip install -r requirements.txt

# 前端依赖
cd web-app
npm install --include=dev
cd ..
```

### 2. 启动开发环境

```bash
./start.sh
```

或分别启动：

```bash
# 启动后端
python3 server.py

# 启动前端（新终端）
cd web-app
npm run dev
```

### 3. 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:10086
- API 文档: http://localhost:10086/docs

### 4. 部署 ops 版本

```bash
./start_ops.sh
```

`ops` 版本默认保留刷题、排行榜和 `beetle` 页面，前端请求地址默认为同源 `/api`。

如果你用 Nginx/Caddy 反向代理，请把：

- `/` 转发到前端服务 `5173`
- `/api` 和 `/ws` 转发到后端服务 `10086`

常用环境变量：

```bash
BACKEND_PORT=10086 FRONTEND_PORT=5173 ./start_ops.sh
```

启动脚本会优先使用项目内 `.venv`；如果你要显式指定 Python，可使用：

```bash
PYTHON_BIN=/path/to/python3 ./start_ops.sh
```

后端也支持直接读取 `APP_HOST`、`APP_PORT` 或平台注入的 `PORT`。

### 5. Electron 桌面端（可选）

```bash
# 先启动后端和 web-app 开发服务，再开 Electron
cd electron-app
npm install
npm run dev
```

## 📁 项目结构

```
.
├── server.py              # FastAPI 后端
├── requirements.txt       # Python 依赖
├── start.sh              # 一键启动脚本
├── README.md             # 项目说明
│
├── web-app/              # React 前端
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── stores/       # 状态管理 (Zustand)
│   │   ├── api/          # API 客户端
│   │   ├── types/        # TypeScript 类型
│   │   └── utils/        # 工具函数
│   ├── package.json
│   └── vite.config.ts
│
├── electron-app/         # Electron 桌面端壳
│   ├── main.js
│   ├── preload.js
│   └── package.json
│
└── tiku/                 # 题库数据
```

## 🎯 使用指南

### 刷题流程

1. **选择题库**：首页选择要练习的题库
2. **选择模式**：
   - 随机模式：随机抽取题目
   - 难题模式：专攻正确率低的题目
   - 章节模式：按章节针对性练习
3. **开始答题**：选择答案，查看解析
4. **查看结果**：统计正确率和用时

### 题库提取流程

1. **上传文件**：支持 PDF、Word、TXT 格式
2. **自动解析**：系统自动提取题目、选项、答案
3. **检查编辑**：核对题目内容，手动修正
4. **生成解析**（可选）：配置 API Key，AI 自动生成解析
5. **导出题库**：下载标准 JSON 格式文件

## 🔧 配置 AI 解析

在题库提取页面配置：

| 提供商 | API Key | 模型 |
|--------|---------|------|
| OpenAI | sk-... | gpt-3.5-turbo |
| DeepSeek | sk-... | deepseek-chat |
| 自定义 | - | - |

## 📊 题库格式

### 标准格式

```json
{
  "meta": {
    "name": "题库名称",
    "total": 100,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "questions": [
    {
      "id": "q0001",
      "type": "single",      // single | multi | judge
      "chapter": "第一章",
      "chapter_id": "ch01",
      "content": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": 0,           // 单选: 索引, 多选: [0,1], 判断: true/false
      "analysis": "解析内容",
      "stats": {
        "total": 100,
        "correct": 80,
        "rate": 80
      }
    }
  ]
}
```

## 🛠️ 开发计划

- [ ] 用户登录系统
- [ ] 云端数据同步
- [ ] 更强大的 AI 解析
- [ ] 错题导出 PDF
- [ ] 模拟考试模式
- [ ] 学习进度图表

## 📄 License

MIT License
