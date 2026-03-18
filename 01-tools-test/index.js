import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"

const apiKey = process.env.MINIMAX_API_KEY
if (!apiKey) {
  throw new Error("Missing MINIMAX_API_KEY in environment")
}

const modelName = process.env.MINIMAX_MODEL_NAME ?? "MiniMax-M2.5"
const baseURL = process.env.MINIMAX_BASE_URL ?? "https://api.minimax.chat/v1"

const model = new ChatOpenAI({
  modelName,
  apiKey,
  configuration: {
    baseURL,
  },
})

const response = await model.invoke("介绍下自己")
console.log(response.content)
