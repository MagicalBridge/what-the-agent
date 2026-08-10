import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"

const apiKey = process.env.ZHIPU_API_KEY
if (!apiKey) {
  throw new Error("Missing ZHIPU_API_KEY in environment")
}

const modelName = process.env.ZHIPU_MODEL_NAME ?? "glm-4.6"
const baseURL = process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4"

const model = new ChatOpenAI({
  modelName,
  apiKey,
  configuration: {
    baseURL,
  },
})

const response = await model.invoke("介绍下自己")
console.log(response.content)