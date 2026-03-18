# LangChain 工具调用笔记（tool 两参数 & 400 报错排查）

## 1. 背景

本项目在 [index.js](file:///Users/chupengfei/code/ai/02-tools-file_read/index.js) 中使用 `@langchain/openai` 的 `ChatOpenAI`，并通过 `@langchain/core/tools` 的 `tool()` 定义一个 `read_file` 工具，让模型在需要时发起工具调用（tool calls），由本地代码执行后再把结果回传给模型继续推理。

## 2. `tool()` 为什么可以接收两个参数？

`tool()` 是 LangChain Core 提供的“工具工厂函数”，它的设计就是 `tool(func, fields)` 两个参数：

### 2.1 第 1 个参数：`func`（工具执行逻辑）

1. `func` 是工具真正要执行的函数（Runnable function）。
2. 当模型发起工具调用时，会生成工具参数（例如 `{ "filePath": "./src/a.js" }`），LangChain 会按 `schema` 做解析/校验，然后把“解析后的入参”传给 `func`。
3. 因此当 `schema` 定义了 `filePath` 字段时，`func` 可以写成：
   1. `async ({ filePath }) => { ... }`

对应代码位置：[readFileTool](file:///Users/chupengfei/code/ai/02-tools-file_read/index.js#L30-L66)。

### 2.2 第 2 个参数：`fields`（工具元信息与入参 Schema）

`fields` 是一个配置对象，主要给两类目标使用：

1. **给模型看**：帮助模型决定“是否调用工具”以及“如何构造参数”。
2. **给运行时用**：帮助运行时把模型的 tool_calls 路由到正确的工具实现，并验证参数。

常用字段：

1. `name`
   1. 工具名（模型 tool_calls 里会使用这个字符串）。
   2. 你的执行器也会用它去 `tools.find((t) => t.name === toolCall.name)`。
2. `description`
   1. 工具描述，会影响模型调用倾向和参数生成质量。
3. `schema`
   1. Zod Schema（或 JSON Schema），定义入参结构。
   2. 让模型知道该生成什么样的 JSON 参数，同时在运行时做校验。

在本项目中：

1. `name: "read_file"`
2. `schema: z.object({ filePath: z.string() })`

对应代码位置：[readFileTool fields](file:///Users/chupengfei/code/ai/02-tools-file_read/index.js#L47-L65)。

### 2.3 类型声明（证据）

你当前依赖版本的 `@langchain/core` 对 `tool()` 的 TypeScript 声明在：

1. [@langchain/core tool 声明](file:///Users/chupengfei/code/ai/02-tools-file_read/node_modules/@langchain/core/dist/tools/index.d.ts#L165-L220)

其中明确写了多个重载，都是 `tool(func, fields)` 形式，并会根据 `schema` 类型返回 `DynamicTool` 或 `DynamicStructuredTool`。

## 3. 400 报错：`tool result's tool id(...) not found (2013)` 是什么问题？

报错示例：

1. `BadRequestError: 400 invalid params, tool result's tool id(call_function_...) not found (2013)`

这类错误通常意味着：你发给模型的 `ToolMessage` 里带了某个 `tool_call_id`，但在“同一条对话消息历史”里，服务端找不到与之对应的 `tool_calls`（也就是缺少那条包含 tool_calls 的 Assistant 消息）。

## 4. 典型错误写法（为什么会触发 400）

在工具循环中，如果你在某一轮：

1. 收到了模型返回的 `response`（里面包含 `response.tool_calls`）
2. 直接执行工具并 push `ToolMessage`
3. 但 **没有先把这条 response（Assistant 消息）push 到 messages**

那么下一次调用模型时，messages 里只有 `ToolMessage`，却没有对应的 `tool_calls`，服务端就会认为你在“凭空回复一个 tool result”，从而报 400。

## 5. 正确做法（保证消息链完整）

每一轮都遵守下面顺序：

1. 把模型响应 `response` 先追加到 `messages`
2. 如果 `response.tool_calls` 存在：
   1. 执行工具
   2. 对每个 toolCall 追加 `ToolMessage({ tool_call_id: toolCall.id, content: ... })`
   3. 再次调用模型
3. 直到 `response.tool_calls` 为空，输出最终 `response.content`

本项目修复后的循环实现位置：

1. [工具循环](file:///Users/chupengfei/code/ai/02-tools-file_read/index.js#L84-L123)

## 6. 额外实践：`read_file` 为什么要拒绝目录？

模型有时会把“目录路径”也当作文件路径来调用工具（例如 `filePath: "."`）。如果你的工具实现盲目 `readFile(".")`：

1. 会抛出错误（目录无法按文件读）
2. 更关键的是会干扰模型的工具调用链路与推理

因此实现中增加了：

1. 路径规范化（相对路径转绝对路径）
2. `fs.stat()` 判断必须是 `isFile()`

对应代码位置：[readFileTool 实现](file:///Users/chupengfei/code/ai/02-tools-file_read/index.js#L30-L46)。

## 7. 小结

1. `tool()` 接收两个参数是框架设计：`tool(func, fields)`。
2. `fields.schema` 既指导模型生成参数，也让运行时校验输入。
3. 400 “tool id not found” 基本都指向“消息历史缺失 tool_calls 对应的 Assistant 消息”。
4. 工具调用循环务必：先 push `response`，再 push `ToolMessage`，再 invoke 下一轮。

