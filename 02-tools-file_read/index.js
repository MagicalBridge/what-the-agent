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

// ---- 辅助函数 ----

/** 执行单个工具调用，返回结果字符串 */
async function executeTool(toolCall) {
  const matchedTool = tools.find((t) => t.name === toolCall.name)
  if (!matchedTool) {
    return `错误: 找不到工具 ${toolCall.name}`
  }

  console.log(`  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`)
  try {
    return await matchedTool.invoke(toolCall.args)
  } catch (error) {
    return `错误: ${error.message}`
  }
}

/** 判断模型响应是否包含工具调用 */
function hasToolCalls(response) {
  return response.tool_calls && response.tool_calls.length > 0
}

/** 并行执行所有工具调用，将结果作为 ToolMessage 追加到 messages */
async function handleToolCalls(toolCalls, messages) {
  console.log(`\n[检测到 ${toolCalls.length} 个工具调用]`)

  const results = await Promise.all(toolCalls.map(executeTool))

  for (let i = 0; i < toolCalls.length; i++) {
    messages.push(
      new ToolMessage({
        content: results[i],
        tool_call_id: toolCalls[i].id,
      }),
    )
  }
}

// ---- 主流程 ----

let response = await modelWithTools.invoke(messages)

// 工具调用循环：模型返回 tool_calls → 执行工具 → 回传结果 → 再次调用模型
while (hasToolCalls(response)) {
  messages.push(response) // 第 1 步：先把 AI 的响应加入消息历史
  await handleToolCalls(response.tool_calls, messages) // 第 2 步：执行工具，把结果加入消息历史
  response = await modelWithTools.invoke(messages) // 第 3 步：带着完整历史再次调用模型
}

// 循环结束，模型不再调用工具，输出最终文本回复
console.log("\n[最终回复]")
console.log(response.content)
