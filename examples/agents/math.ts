import { z } from 'zod'
import { createTask } from 'hataraku'
import { addTool, multiplyTool } from '../tools/math'
import { createBaseAgent, ROLES, DESCRIPTIONS } from './base'

// Initialize the math agent
export const initializeMathAgent = async () => {
  return createBaseAgent({
    name: 'Math Agent',
    description: DESCRIPTIONS.MATH,
    role: ROLES.MATH,
    tools: {
      add: addTool,
      multiply: multiplyTool,
    },
  })
}

// Schemas
export const schemas = {
  mathInput: z.object({
    a: z.number(),
    b: z.number(),
  }),
  mathOutput: z.number(),
  numbersToWords: z.object({
    number: z.number(),
  }),
}

// Create math tasks
export const createMathTasks = async () => {
  const mathAgent = await initializeMathAgent()

  return {
    add: createTask({
      name: 'Add Numbers',
      description: 'Adds two numbers together',
      agent: mathAgent,
      outputSchema: schemas.mathOutput,
      task: (input: z.infer<typeof schemas.mathInput>) =>
        `Use the add tool to add these numbers: ${input.a} and ${input.b}.`,
    }),

    multiply: createTask({
      name: 'Multiply Numbers',
      description: 'Multiplies two numbers together',
      agent: mathAgent,
      outputSchema: schemas.mathOutput,
      task: (input: z.infer<typeof schemas.mathInput>) =>
        `Use the multiply tool to multiply these numbers: ${input.a} and ${input.b}`,
    }),

    toWords: createTask({
      name: 'Numbers to Words',
      description: 'Converts a number to its word representation',
      agent: mathAgent,
      outputSchema: z.string(),
      task: (input: z.infer<typeof schemas.numbersToWords>) =>
        `convert this number to its word representation: ${input.number}`,
    }),
  }
}
