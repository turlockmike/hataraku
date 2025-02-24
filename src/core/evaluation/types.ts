import { TaskExecutor } from "../workflow"
import z from "zod"

export type Evaluater<TTaskOutput> = TaskExecutor<TTaskOutput, EvaluationResult>

export const EvaluationResultSchema = z.object({
	score: z.number(),
	reason: z.string().optional(),
})

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>
