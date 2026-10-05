# What The Agent

一个基于 **LangChain.js** 的 AI Agent 学习项目，按“模型连通 -> Tool Calling -> 本地工具 Agent -> MCP 集成”的路径逐步展开。

这个仓库更像一组递进式练习，而不是单一应用：前两个目录聚焦 LangChain 工具调用基础，后两个目录开始往“可执行任务的 Agent”方向走。

## 学习路径

1. `01-tools-test`：先验证模型接入和最基本的 `invoke()`
2. `02-tools-file_read`：加入 `read_file` 工具，理解 Tool Call Loop
3. `03-mini-cursor`：把多个本地工具组合成一个 CLI Agent
4. `tool-test`：继续实验 MCP Server / Client、多服务集成与更多模型配置

## 技术栈

- **LangChain.js**：`@langchain/openai`、`@langchain/core`、`@langchain/mcp-adapters`
- **模型接入**：
  - 智谱 GLM（默认 `glm-4.6`，通过 OpenAI 兼容接口接入）
  - 通义千问（部分实验脚本使用 `qwen-plus` / `qwen-coder-turbo`）
- **MCP Protocol**：`@modelcontextprotocol/sdk`
- **Node.js**：以 ES Module 为主，实验目录里包含 CommonJS 配置
- **Zod**：工具参数校验
- **Chalk**：命令行彩色输出

## 项目结构

```text
01-tools-test/        # 最小化模型调用示例
02-tools-file_read/   # 单工具 + 完整 Tool Call Loop
03-mini-cursor/       # 带文件读写/命令执行/目录浏览的 CLI Agent
tool-test/            # MCP 与更多实验脚本
```

## 目录说明

### 01-tools-test

最小可运行示例，只做一件事：通过 LangChain 的 `ChatOpenAI` 接入智谱 GLM，然后发起一次简单对话。

适合用来确认：

- API Key 是否可用
- OpenAI 兼容 `baseURL` 是否配置正确
- LangChain 基础调用链是否跑通

运行方式：

```bash
cd 01-tools-test
npm install
cp .env.example .env
npm start
```

### 02-tools-file_read

在最小示例基础上引入 `read_file` 工具，并实现完整的工具调用循环：

- 用 `tool()` 定义结构化工具
- 用 `bindTools()` 把工具绑定给模型
- 维护 `SystemMessage` / `HumanMessage` / `ToolMessage` 消息链
- 通过 `tool_call_id` 回传工具结果，避免 `tool_call_id not found`

默认行为是让模型读取并解释当前目录下的 `index.js`。

运行方式：

```bash
cd 02-tools-file_read
npm install
cp .env.example .env
npm start
```

补充笔记见：`02-tools-file_read/docs/langchain-tool-calls-notes.md`

### 03-mini-cursor

这是一个简化版的命令行 Agent。入口在 `index.mjs`，核心循环在 `src/mini-cursor.mjs`，内置 4 个工具：

- `read_file`：读取文件
- `write_file`：写入文件，并自动创建目录
- `execute_command`：执行系统命令，支持 `workingDirectory`
- `list_directory`：列出目录内容

这个目录已经不只是“演示工具调用”，而是在模拟一个能读文件、改文件、跑命令的开发助手。

运行方式：

```bash
cd 03-mini-cursor
npm install
cp .env.example .env
npm start
```

也可以直接传入问题：

```bash
node index.mjs "请读取当前目录的 package.json 并说明其内容"
```

### tool-test

这是实验区，里面的脚本更偏“验证思路”而不是统一入口程序。

主要内容包括：

| 脚本 | 说明 |
| --- | --- |
| `src/hello-langchain.mjs` | LangChain 最小示例，使用通义千问直连对话 |
| `src/tool-file-read.mjs` | 单文件 `read_file` 工具调用示例 |
| `src/all-tools.mjs` | 一组通用本地工具定义 |
| `src/mini-cursor.mjs` | 通义千问版本的 Mini Cursor Agent |
| `src/my-mcp-server.mjs` | 自定义 MCP Server，提供 `query_user` 工具和资源 |
| `src/langchain-mcp-test.mjs` | LangChain 连接自定义 MCP Server 的示例 |
| `src/mcp-test.mjs` | 多 MCP 服务集成示例（高德地图、文件系统、Chrome DevTools 等） |
| `src/node-exec.mjs` | Node 执行命令测试脚本 |

`tool-test` 没有统一的 `start` 命令，通常按脚本直接执行，例如：

```bash
cd tool-test
npm install
node src/hello-langchain.mjs
```

## 环境变量

这个仓库里主要有两类模型配置：

### 智谱 GLM（01 / 02 / 03 默认使用）

```env
ZHIPU_API_KEY=
ZHIPU_MODEL_NAME=glm-4.6
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

### OpenAI 兼容配置（tool-test 部分脚本使用）

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=
MODEL_NAME=
```

部分 MCP 实验脚本还会额外用到：

- `AMAP_MAPS_API_KEY`
- `ALLOWED_PATHS`

## 这个仓库里能学到什么

- 如何把非 OpenAI 厂商模型接入 `ChatOpenAI`
- 如何定义 LangChain Tool，并用 Zod 约束入参
- 如何维护完整消息历史，正确执行 Tool Call Loop
- 如何把多个本地工具封装成一个可迭代执行的 Agent
- 如何通过 MCP 把外部能力接入 LangChain

## 快速开始

如果你是第一次打开这个仓库，推荐从 `01-tools-test` 开始：

```bash
cd 01-tools-test
npm install
cp .env.example .env
npm start
```

跑通后再按顺序继续看：

```text
01-tools-test -> 02-tools-file_read -> 03-mini-cursor -> tool-test
```

## 说明

- 根目录 README 负责总览；更细的实现细节可以继续看各子目录代码和子 README
- `tool-test` 更偏实验性质，部分脚本里还保留了本地绝对路径或临时测试配置，运行前建议先按需调整
