# LangChain 工具调用笔记（tool 两参数 & 400 报错排查）

## 1. 背景

本项目在 [index.js](./index.js) 中使用 `@langchain/openai` 的 `ChatOpenAI`，并通过 `@langchain/core/tools` 的 `tool()` 定义一个 `read_file` 工具，让模型在需要时发起工具调用（tool calls），由本地代码执行后再把结果回传给模型继续推理。

> **注意**：虽然使用了 `ChatOpenAI` 类，但实际连接的是 **MiniMax API**（模型 `MiniMax-M2.7`），通过 `configuration.baseURL` 指向 `https://api.minimax.chat/v1`。`ChatOpenAI` 在这里作为兼容 OpenAI 接口规范的通用客户端使用。不同提供商对 tool calls 的实现可能存在差异，这也是后文 400 报错需要关注的背景之一。

## 2. `tool()` 为什么可以接收两个参数？

`tool()` 是 LangChain Core 提供的“工具工厂函数”，它的设计就是 `tool(func, fields)` 两个参数：

### 2.1 第 1 个参数：`func`（工具执行逻辑）

1. `func` 是工具真正要执行的函数（Runnable function）。
2. 当模型发起工具调用时，会生成工具参数（例如 `{ "filePath": "./src/a.js" }`），LangChain 会按 `schema` 做解析/校验，然后把“解析后的入参”传给 `func`。
3. 因此当 `schema` 定义了 `filePath` 字段时，`func` 可以写成：
   1. `async ({ filePath }) => { ... }`

对应代码位置：[readFileTool](./index.js#L30-L59)。

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
   2. 应该写清楚工具的用途、适用场景和输入说明，帮助模型判断何时以及如何调用。
3. `schema`
   1. Zod Schema（或 JSON Schema），定义入参结构。
   2. 让模型知道该生成什么样的 JSON 参数，同时在运行时做校验。
   3. 可以在字段上使用 `.describe()` 为参数添加说明，帮助模型理解参数用途。例如 `z.string().describe("要读取的文件路径")`。

在本项目中：

1. `name: "read_file"`
2. `description: "用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。"`
3. `schema: z.object({ filePath: z.string().describe("要读取的文件路径") })`

对应代码位置：[readFileTool fields](./index.js#L51-L58)。

### 2.3 类型声明（证据）

你当前依赖版本的 `@langchain/core` 对 `tool()` 的 TypeScript 声明在：

1. `node_modules/@langchain/core/dist/tools/index.d.ts#L165-L220`

其中明确写了多个重载，都是 `tool(func, fields)` 形式，并会根据 `schema` 类型返回 `DynamicTool` 或 `DynamicStructuredTool`。

## 3. `bindTools()`：将工具绑定到模型

定义好工具后，需要通过 `model.bindTools(tools)` 将工具列表绑定到模型实例：

```js
const tools = [readFileTool]
const modelWithTools = model.bindTools(tools)
```

`bindTools()` 的作用是：

1. 将工具的 `name`、`description`、`schema` 转换为模型 API 所需的 `tools` 参数格式（如 OpenAI 的 function calling 格式）。
2. 返回一个新的模型实例，后续调用 `invoke()` 时会自动携带工具定义。
3. 模型收到工具定义后，就知道有哪些工具可用，可以在回复中发起 `tool_calls`。

对应代码位置：[bindTools](./index.js#L64)。

## 4. 400 报错：`tool result's tool id(...) not found (2013)` 是什么问题？

报错示例：

1. `BadRequestError: 400 invalid params, tool result's tool id(call_function_...) not found (2013)`

这类错误通常意味着：你发给模型的 `ToolMessage` 里带了某个 `tool_call_id`，但在“同一条对话消息历史”里，服务端找不到与之对应的 `tool_calls`（也就是缺少那条包含 tool_calls 的 Assistant 消息）。

## 5. 典型错误写法（为什么会触发 400）

在工具循环中，如果你在某一轮：

1. 收到了模型返回的 `response`（里面包含 `response.tool_calls`）
2. 直接执行工具并 push `ToolMessage`
3. 但 **没有先把这条 response（Assistant 消息）push 到 messages**

那么下一次调用模型时，messages 里只有 `ToolMessage`，却没有对应的 `tool_calls`，服务端就会认为你在“凭空回复一个 tool result”，从而报 400。

## 6. 正确做法（保证消息链完整）

每一轮都遵守下面顺序：

1. 把模型响应 `response` 先追加到 `messages`
2. 如果 `response.tool_calls` 存在：
   1. 执行工具
   2. 对每个 toolCall 追加 `ToolMessage({ tool_call_id: toolCall.id, content: ... })`
   3. 再次调用模型
3. 直到 `response.tool_calls` 为空，输出最终 `response.content`

### 6.1 并行执行多个工具调用

当模型一次返回多个 `tool_calls` 时，可以使用 `Promise.all` 并行执行所有工具调用，提高效率：

```js
const toolResults = await Promise.all(
  response.tool_calls.map(async (toolCall) => {
    const matchedTool = tools.find((t) => t.name === toolCall.name)
    if (!matchedTool) {
      return `错误: 找不到工具 ${toolCall.name}`
    }
    try {
      const result = await matchedTool.invoke(toolCall.args)
      return result
    } catch (error) {
      return `错误: ${error.message}`
    }
  }),
)
```

注意这里的错误处理：
- **工具匹配失败**：当 `tools.find()` 找不到对应工具时，返回错误字符串而非抛出异常，确保不会中断整个循环。
- **工具执行异常**：用 `try/catch` 捕获工具内部错误，将错误信息作为结果返回给模型，让模型知道发生了什么并决定下一步。

这两种情况下，错误信息都会被包装到 `ToolMessage` 中回传给模型，保持消息链完整。

本项目修复后的循环实现位置：

1. [工具循环](./index.js#L86-L127)

## 7. 额外实践：`read_file` 为什么要拒绝目录？

模型有时会把“目录路径”也当作文件路径来调用工具（例如 `filePath: "."`）。如果你的工具实现盲目 `readFile(".")`：

1. 会抛出错误（目录无法按文件读）
2. 更关键的是会干扰模型的工具调用链路与推理

因此实现中增加了：

1. 路径规范化（相对路径转绝对路径）
2. `fs.stat()` 判断必须是 `isFile()`

对应代码位置：[readFileTool 实现](./index.js#L30-L49)。

## 8. 完整调用流程总览

```
定义工具 tool(func, fields)
        ↓
绑定工具 model.bindTools(tools)
        ↓
构建消息 [SystemMessage, HumanMessage]
        ↓
调用模型 modelWithTools.invoke(messages)
        ↓
  ┌─ response 有 tool_calls？
  │    ↓ 是
  │  1. push response 到 messages
  │  2. 并行执行所有工具 (Promise.all)
  │  3. 对每个 toolCall push ToolMessage
  │  4. 再次 invoke → 回到判断
  │    ↓ 否
  └─ 输出 response.content
```

## 9. 小结

1. `tool()` 接收两个参数是框架设计：`tool(func, fields)`。
2. `fields.schema` 既指导模型生成参数，也让运行时校验输入；`.describe()` 可为参数添加说明。
3. `bindTools()` 是从”定义工具”到”模型可调用工具”的关键桥梁。
4. 400 “tool id not found” 基本都指向”消息历史缺失 tool_calls 对应的 Assistant 消息”。
5. 工具调用循环务必：先 push `response`，再 push `ToolMessage`，再 invoke 下一轮。
6. 多个工具调用可用 `Promise.all` 并行执行，但要做好匹配失败和执行异常的错误处理。

