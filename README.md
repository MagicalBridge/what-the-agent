# What The Agent

一个基于 **LangChain.js** 的 AI Agent 学习项目，通过递进式示例探索大模型工具调用（Tool Calling）机制、MCP 协议集成等。

## 技术栈

- **LangChain.js** (`@langchain/openai`, `@langchain/core`, `@langchain/mcp-adapters`)
- **智谱 GLM** 大模型（默认 `glm-4.6`，通过 OpenAI 兼容接口接入）
- **通义千问** 大模型（部分示例使用 `qwen-plus` / `qwen-coder-turbo`）
- **MCP Protocol**（`@modelcontextprotocol/sdk`，Model Context Protocol 集成）
- **Node.js**（ES Module / CommonJS）
- **Zod**（工具参数校验）
- **Chalk**（控制台彩色输出）

## 项目结构

```
01-tools-test/        # 基础示例：连接智谱 GLM 模型并进行简单对话
02-tools-file_read/   # 进阶示例：实现 read_file 工具，完成完整的工具调用循环
03-mini-cursor/       # Mini Cursor：具备文件读写、命令执行、目录列表能力的 Agent
tool-test/            # 实验区：MCP 服务端/客户端、多 MCP 服务器集成（高德地图、文件系统、Chrome DevTools 等）
```

## 示例说明

### 01-tools-test

最小化示例，演示如何通过 LangChain 的 `ChatOpenAI` 接入**智谱 GLM**模型并完成一次对话调用。

### 02-tools-file_read

实现了一个具备文件读取能力的 AI 助手，涵盖：

- 使用 `tool()` 工厂函数定义结构化工具（含 Zod Schema）
- `bindTools()` 将工具绑定到模型
- 完整的工具调用循环（Tool Call Loop）：模型请求 → 执行工具 → 返回结果 → 模型继续推理
- 消息链路管理（避免 `tool_call_id not found` 错误）

包含技术笔记 `docs/langchain-tool-calls-notes.md`，详细讲解 LangChain 工具调用原理。

### 03-mini-cursor

类 Cursor 风格的 CLI Agent，具备完整的本地开发工具能力：

- **4 个内置工具**（`src/all-tools.mjs`）：
  1. `read_file` - 读取文件内容
  2. `write_file` - 写入文件（自动创建目录）
  3. `execute_command` - 执行系统命令（支持 `workingDirectory` 参数，实时输出）
  4. `list_directory` - 列出目录内容
- Agent 主循环封装在 `src/mini-cursor.mjs`，最大 30 轮迭代
- 支持命令行传入查询，如：`node index.mjs 请读取 package.json 并说明依赖`
- 使用 Chalk 实现友好的彩色控制台输出

### tool-test（实验区）

包含多个独立实验脚本，涵盖不同模型与 MCP 集成场景：

| 脚本 | 功能 |
| --- | --- |
| `hello-langchain.mjs` | LangChain 最小示例（通义千问 qwen-coder-turbo，直连对话） |
| `tool-file-read.mjs` | 单文件 read_file 工具调用示例（通义千问） |
| `all-tools.mjs` | 4 个通用工具集合（与 03-mini-cursor 相同） |
| `mini-cursor.mjs` | Mini Cursor Agent（通义千问 qwen-plus 版本 + 彩色输出 + React TodoList 用例） |
| `my-mcp-server.mjs` | 自定义 MCP Server（Stdio 协议），内置用户查询工具 `query_user` 与文档资源 |
| `langchain-mcp-test.mjs` | LangChain 接入自定义 MCP Server（MultiServerMCPClient） |
| `mcp-test.mjs` | 多 MCP 服务器集成示例：自定 MCP + 高德地图 API + 文件系统 MCP + Chrome DevTools MCP |
| `node-exec.mjs` | Node 命令执行测试 |

**MCP 集成关键特性**：
- 通过 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 统一管理多个 MCP 服务
- 支持 Stdio 子进程模式（如 `my-mcp-server`、`filesystem`、`chrome-devtools`）
- 支持 HTTP Streamable 模式（如高德地图 MCP）
- 自动将 MCP Tool 转换为 LangChain Tool 并绑定到模型
- 支持读取 MCP Resource 并作为系统提示注入

## 快速开始

```bash
# 进入任一示例目录
cd 01-tools-test

# 安装依赖（或使用 pnpm install）
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的智谱 API Key（ZHIPU_API_KEY）
# 部分通义千问示例需要配置 OPENAI_API_KEY / OPENAI_BASE_URL

# 运行
npm start
```

> **注意**：`tool-test/` 下为实验脚本，无 `npm start`，请通过 `node src/xxx.mjs` 直接执行对应的脚本文件。部分脚本（如 `mcp-test.mjs`）还需要配置 `AMAP_MAPS_API_KEY`、`ALLOWED_PATHS` 等额外环境变量。
