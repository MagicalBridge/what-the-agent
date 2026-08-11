# 01-tools-test

最小化示例：用 LangChain.js 的 `ChatOpenAI` 接入 **智谱 AI**（OpenAI 兼容接口），完成一次简单对话。

本目录是整个 Agent 学习路径的第一步，只验证「模型连通 + 基础调用」，不含工具（Tool Calling）。进阶示例见 [`../02-tools-file_read`](../02-tools-file_read)。

## 你会学到什么

- 用 `dotenv` 读取环境变量
- 通过 `configuration.baseURL` 把 `ChatOpenAI` 指向非 OpenAI 的兼容服务
- 调用 `model.invoke()` 发送一条消息并打印回复

## 技术栈

| 依赖 | 用途 |
| --- | --- |
| `@langchain/openai` | `ChatOpenAI` 客户端（兼容 OpenAI 协议） |
| `dotenv` | 加载 `.env` |
| Node.js（ES Module） | 运行时（`package.json` 中 `"type": "module"`） |

## 环境变量

复制示例配置并填入 Key：

```bash
cp .env.example .env
```

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ZHIPU_API_KEY` | 是 | — | 智谱开放平台 API Key |
| `ZHIPU_MODEL_NAME` | 否 | `glm-4.6` | 模型名称 |
| `ZHIPU_BASE_URL` | 否 | `https://open.bigmodel.cn/api/paas/v4` | OpenAI 兼容接口地址 |

> 缺失 `ZHIPU_API_KEY` 时，程序会直接抛错退出。

## 快速开始

```bash
# 安装依赖（npm / pnpm 均可）
npm install

# 配置 .env 后运行
npm start
```

成功时会在终端打印模型对「介绍下自己」的回复。

语法检查（不发起真实请求）：

```bash
npm test
```

## 代码概览

入口在 [`index.js`](./index.js)：

1. `import "dotenv/config"` 加载环境变量
2. 校验并读取 `ZHIPU_*` 配置
3. 创建 `ChatOpenAI` 实例（`apiKey` + `baseURL`）
4. `await model.invoke("介绍下自己")`，输出 `response.content`

核心逻辑大致如下：

```js
const model = new ChatOpenAI({
  modelName,
  apiKey,
  configuration: { baseURL },
})

const response = await model.invoke("介绍下自己")
console.log(response.content)
```

## 下一步

连通无误后，可进入 [`02-tools-file_read`](../02-tools-file_read)：定义 `read_file` 工具、`bindTools()`，以及完整的 Tool Call Loop。
