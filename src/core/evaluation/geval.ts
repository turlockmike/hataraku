import { LanguageModelV1 } from "ai"
import { Agent } from "../agent"
import z from "zod"

export class GEval extends Agent {
	constructor(config: { model: LanguageModelV1 }) {
		super({
			model: config.model,
			name: "GEval",
			description: "A tool for generating evaluation steps for a given set of parameters and criteria.",
			role: "You are a helpful assistant that generates evaluation steps for a given set of parameters and criteria.",
		})
	}

	async generateEvalutionSteps(parameters: string[], criteria: string): Promise<string[]> {
		const { steps } = await this.task(
			`Given an evaluation criteria which outlines how you should judge the ${parameters.join(
				", "
			)}, generate 3-4 concise evaluation steps based on the criteria below. You MUST make it clear how to evaluate ${parameters} in relation to one another.

Evaluation Criteria:
${criteria}`,
			{
				schema: z.object({
					steps: z.array(z.string()),
				}),
			}
		)

		return steps
	}

	async evaluate(parameters: string[], evaluationSteps: string[], criteria: string) {
		const evaluation = await this.task(
			`Given the evaluation steps, return \`score\` key ranging from 0 - 10, with 10 being that it follows the criteria outlined in the steps and 0 being that it does not, and 2) \`reason\`, a reason for the given score, but DO NOT QUOTE THE SCORE in your reason. Please mention specific information from ${parameters.join(
				", "
			)} in your reason, but be very concise with it!

Evaluation Steps:
${evaluationSteps.join("\n")}

${criteria}
`,
			{
				schema: z.object({
					score: z.number(),
					reason: z.string(),
				}),
			}
		)

		return evaluation
	}

	async measure(parameters: string[], criteria: string) {
		const evaluationSteps = await this.generateEvalutionSteps(parameters, criteria)
		const evaluation = await this.evaluate(parameters, evaluationSteps, criteria)

		return evaluation
	}

	async correctness(testCase: { actualOutput: string; expectedOutput: string }) {
		return this.measure(
			[`actual_output:${testCase.actualOutput}`, `expected_output:${testCase.expectedOutput}`],
			"Determine if the 'actual output' is correct based on the 'expected output"
		)
	}

	async completeness(testCase: { actualOutput: string; expectedOutput: string }) {
		return this.measure(
			[`actual_output:${testCase.actualOutput}`, `expected_output:${testCase.expectedOutput}`],
			"Determine if the 'actual output' is complete and covers all aspects of the 'expected output"
		)
	}

	async reterivalContext(testCase: { actualOutput: string; context: string }) {
		return this.measure(
			[`actual_output:${testCase.actualOutput}`, `context:${testCase.context}`],
			"Determine if the 'actual output' is contextually correct based on the 'context'"
		)
	}

	async full(testCase: { actualOutput: string; expectedOutput: string; context: string }) {
		return this.measure(
			[
				`actual_output:${testCase.actualOutput}`,
				`expected_output:${testCase.expectedOutput}`,
				`context:${testCase.context}`,
			],
			"Determine if the 'actual output' is correct, complete, and contextually correct based on the 'expected output' and 'context'"
		)
	}
}
