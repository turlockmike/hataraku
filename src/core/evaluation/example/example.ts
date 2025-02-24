import { TaskHistory } from "src/core/TaskHistory"
import { createAgent } from "../../agent"
import { createTask } from "../../task"
import { createOpenRouter, LanguageModelV1 } from "@openrouter/ai-sdk-provider"
import { z } from "zod"
// Initialize OpenRouter
const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

export const createAwsFindingTasks = (config: { model: LanguageModelV1; taskHistory?: TaskHistory }) => {
	const agent = createAgent({
		model: config.model,
		name: "AWS Finding Analyzer",
		description: "An agent that analyzes OCSF findings from AWS CloudTrail",
		role: "You are an expert AWS security analyst who analyzes OCSF findings from AWS CloudTrail",
		taskHistory: config.taskHistory,
	})

	const findResourceArnTask = createTask({
		name: "Determines resource from finding",
		description: "Determine the resource's ARN from the finding",
		agent: agent,
		task: (finding: string) => `
		Determine the resource's ARN from the finding. return the ARN only, nothing else. If you cannot find the ARN, return "no arn found".
        <finding>
		${finding}
        </finding>
	`,
	})

	return {
		findResourceArnTask,
	}
}
