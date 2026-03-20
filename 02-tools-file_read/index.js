import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"
import { tool } from "@langchain/core/tools"
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages"
import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

const apiKey = process.env.MINIMAX_API_KEY
if (!apiKey) {
  throw new Error("Missing MINIMAX_API_KEY in environment")
}

const modelName = process.env.MINIMAX_MODEL_NAME ?? "MiniMax-M2.7"
const baseURL = process.env.MINIMAX_BASE_URL ?? "https://api.minimax.chat/v1"

const model = new ChatOpenAI({
  modelName,
  apiKey,
  temperature: 0,
  configuration: {
    baseURL,
  },
})

// 这个tool函数 传入了两个参数
const readFileTool = tool(
  async ({ filePath }) => {
    // 解析文件路径，支持相对路径和绝对路径
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath)

    // 检查路径是否存在且是文件
    const stat = await fs.stat(resolvedPath)
    if (!stat.isFile()) {
      throw new Error(`路径不是文件: ${filePath}`)
    }
    // 读取文件内容
    const content = await fs.readFile(resolvedPath, "utf-8")
    console.log(
      `  [工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`,
    )
    // 返回文件内容
    return `文件内容:\n${content}`
  },
  {
    name: "read_file",
    description:
      "用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。",
    schema: z.object({
      filePath: z.string().describe("要读取的文件路径"),
    }),
  },
)

const tools = [readFileTool]

// 绑定工具到模型
const modelWithTools = model.bindTools(tools)

const messages = [
  new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释

注意：
- 只读取“文件”，不要对目录路径调用 read_file
- 如果用户提供的是目录或不明确的路径，不要猜测；先让用户给出具体文件路径

可用工具：
- read_file: 读取文件内容（使用此工具来获取文件内容）
`),
  new HumanMessage("请读取 ./index.js 文件内容并解释代码"),
]

let response = await modelWithTools.invoke(messages)

while (true) {
  messages.push(response)

  if (!response.tool_calls || response.tool_calls.length === 0) {
    break
  }

  console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`)

  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const matchedTool = tools.find((t) => t.name === toolCall.name)
      if (!matchedTool) {
        return `错误: 找不到工具 ${toolCall.name}`
      }

      console.log(
        `  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
      )
      try {
        const result = await matchedTool.invoke(toolCall.args)
        return result
      } catch (error) {
        return `错误: ${error.message}`
      }
    }),
  )

  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index],
        tool_call_id: toolCall.id,
      }),
    )
  })

  response = await modelWithTools.invoke(messages)
}

console.log("\n[最终回复]")
console.log(response.content)
