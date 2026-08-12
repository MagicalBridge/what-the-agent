import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages"
import {
  executeCommandTool,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
} from "./all-tools.mjs"

const apiKey = process.env.ZHIPU_API_KEY
if (!apiKey) {
  throw new Error("Missing ZHIPU_API_KEY in environment")
}

const modelName = process.env.ZHIPU_MODEL_NAME ?? "glm-4.6"
const baseURL =
  process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4"

const model = new ChatOpenAI({
  modelName,
  apiKey,
  temperature: 0,
  configuration: {
    baseURL,
  },
})

const tools = [
  readFileTool,
  writeFileTool,
  executeCommandTool,
  listDirectoryTool,
]

// 绑定工具到模型
const modelWithTools = model.bindTools(tools)

// Agent 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. execute_command: 执行命令（支持 workingDirectory 参数）
4. list_directory: 列出目录

重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
这是错误的！因为 workingDirectory 已经在 react-todo-app 目录了，再 cd react-todo-app 会找不到目录
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }
这样就对了！workingDirectory 已经切换到 react-todo-app，直接执行命令即可

重要规则 - write_file：
- 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入
`),
    new HumanMessage(query),
  ]

  for (let i = 0; i < maxIterations; i++) {
    console.log(`⏳ 正在等待 AI 思考...`)
    const response = await modelWithTools.invoke(messages)
    messages.push(response)

    // 检查是否有工具调用
    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`)
      return response.content
    }

    // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name)
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args)
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        )
      }
    }
  }

  return messages[messages.length - 1].content
}

export { runAgentWithTools, model, tools, modelWithTools }
