import { createAwsFindingTasks, FindingResult } from "../evaluations"
import fs from "fs"
import { Thread, createTaskTestGenerator } from "hataraku"

describe("AWS Finding Analyzer", () => {
	let tasks: Awaited<ReturnType<typeof createAwsFindingTasks>>
	let testGenerator: Awaited<ReturnType<typeof createTaskTestGenerator>>
	beforeEach(async () => {
		tasks = await createAwsFindingTasks()
		testGenerator = await createTaskTestGenerator()
	})

	it("should determine the resource from the finding", async () => {
		const thread = new Thread()
		const finding = fs.readFileSync(
			"/Users/robertpottschmidt/code/hataraku/examples/__tests__/evaluations-finding.json",
			"utf8"
		)

		let result: FindingResult
		try {
			result = await tasks.findResourceArnTask.run(
				{ finding },
				{
					thread,
					stream: false,
					verbose: true,
				}
			)
		} catch (error) {
			console.error("err", error)
			console.log("thread", thread.getFormattedMessages())
			throw error
		}

		expect(result.arn).toBe("arn:aws:lambda:us-east-1:590343059372:function:Extend_API_IncredibotUpdate")
	})

	it("should execute generated test cases", async () => {
		const testCases = await testGenerator.generateTestCasesForTask(tasks.findResourceArnTask, {
			count: 1,
			samples: [
				{
					input: {
						finding: fs.readFileSync(
							"/Users/robertpottschmidt/code/hataraku/examples/__tests__/evaluations-finding.json",
							"utf8"
						),
					},
					expected_output: {
						arn: "arn:aws:lambda:us-east-1:590343059372:function:Extend_API_IncredibotUpdate",
					},
					description: "A finding for a lambda function",
				},
			],
		})
		console.log("testCases", testCases)
	}, 1000000)
})
