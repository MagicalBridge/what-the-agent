import "dotenv/config"
import { runAgentWithTools } from "./src/mini-cursor.mjs"

const query =
  process.argv.slice(2).join(" ") ||
  `请读取当前目录的 package.json 并说明其内容`

try {
  await runAgentWithTools(query)
} catch (error) {
  console.error(`\n❌ 错误: ${error.message}\n`)
}
