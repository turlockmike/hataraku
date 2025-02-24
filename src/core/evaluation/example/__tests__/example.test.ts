import { openrouter } from "@openrouter/ai-sdk-provider"
import { createAwsFindingTasks } from "../example"
import { Task } from "../../../task"
import fs from "fs"
import { TaskHistory } from "../../../TaskHistory"
import { Thread } from "../../../thread"
describe("AWS Finding Analyzer", () => {
	let tasks: ReturnType<typeof createAwsFindingTasks>
	let taskHistory: TaskHistory
	beforeEach(() => {
		taskHistory = new TaskHistory()
		tasks = createAwsFindingTasks({
			model: openrouter.chat("meta-llama/Meta-Llama-3-8B-Instruct"),
			taskHistory,
		})
	})
	it("should determine the resource from the finding", async () => {
		const thread = new Thread()
		const finding = fs.readFileSync(
			"/Users/robertpottschmidt/code/hataraku/src/core/evaluation/example/__tests__/example-finding.json",
			"utf8"
		)

		let arn: string
		try {
			arn = await tasks.findResourceArnTask.run(finding, {
				thread,
				stream: false,
			})
		} catch (error) {
			console.error("err", error)
			const history = await taskHistory.listTasks()
			console.log("history", history)
			console.log("thread", thread.getFormattedMessages())
			throw error
		}

		expect(arn).toBe("arn:aws:lambda:us-east-1:590343059372:function:Extend_API_IncredibotUpdate")
	})
})
