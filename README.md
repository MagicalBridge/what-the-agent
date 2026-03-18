# What The Agent

一个基于 **LangChain.js** 的 AI Agent 学习项目，通过递进式示例探索大模型工具调用（Tool Calling）机制。

## 技术栈

- **LangChain.js** (`@langchain/openai`, `@langchain/core`)
- **MiniMax** 大模型（通过 OpenAI 兼容接口接入）
- **Node.js**（ES Module）
- **Zod**（工具参数校验）

## 项目结构

```
01-tools-test/        # 基础示例：连接 MiniMax 模型并进行简单对话
02-tools-file_read/   # 进阶示例：实现 read_file 工具，完成完整的工具调用循环
```

## 示例说明

### 01-tools-test

最小化示例，演示如何通过 LangChain 的 `ChatOpenAI` 接入 MiniMax 模型并完成一次对话调用。

### 02-tools-file_read

实现了一个具备文件读取能力的 AI 助手，涵盖：

- 使用 `tool()` 工厂函数定义结构化工具（含 Zod Schema）
- `bindTools()` 将工具绑定到模型
- 完整的工具调用循环（Tool Call Loop）：模型请求 → 执行工具 → 返回结果 → 模型继续推理
- 消息链路管理（避免 `tool_call_id not found` 错误）

## 快速开始

```bash
# 进入任一示例目录
cd 01-tools-test

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 MiniMax API Key

# 运行
npm start
```
