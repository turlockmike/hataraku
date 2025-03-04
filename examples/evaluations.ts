import { z } from "zod"
import { createTask } from "hataraku"
import { createBaseAgent } from "./agents/base"

const findingOutputSchema = z.object({
	arn: z.string(),
})

export type FindingResult = z.infer<typeof findingOutputSchema>

export const createAwsFindingTasks = async () => {
	const agent = await createBaseAgent({
		name: "AWS Finding Analyzer",
		description: "An agent that analyzes OCSF findings from AWS CloudTrail",
		role: "You are an expert AWS security analyst who analyzes OCSF findings from AWS CloudTrail",
	})

	const findResourceArnTask = createTask({
		name: "Determines resource from finding",
		description: "Determine the resource's ARN from the finding",
		agent: agent,
		inputSchema: z.object({
			finding: z.string(),
		}),
		outputSchema: findingOutputSchema,
		task: (input: { finding: string }) => `
		Extract the resource ARN from the finding and return it in JSON format like this: {"arn": "the-arn-value"}. If no ARN is found, return {"arn": "no arn found"}.
        <finding>
		${input.finding}
        </finding>
	`,
	})

	return {
		agent,
		findResourceArnTask,
	}
}
