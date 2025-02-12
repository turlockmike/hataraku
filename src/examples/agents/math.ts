import { z } from 'zod';
import { createAgent } from '../../core/agent';
import { createTask } from '../../core/task';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { addTool, multiplyTool } from '../tools/math'
// Initialize OpenRouter
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Create the math agent
export const mathAgent = createAgent({
  name: 'Math Agent',
  description: 'An agent that performs mathematical operations',
  role: 'You are a mathematical computation agent that performs precise calculations. Always use the provided tools for calculations.',
  model: openrouter.chat('anthropic/claude-3.5-sonnet'),
  tools: {
    add: addTool,
    multiply: multiplyTool
  }
});

// Schemas
export const schemas = {
  mathInput: z.object({
    a: z.number(),
    b: z.number()
  }),
  mathOutput: z.number(),
  numbersToWords: z.object({
    number: z.number()
  })
};

// Tasks
export const mathTasks = {
  add: createTask({
    name: 'Add Numbers',
    description: 'Adds two numbers together',
    agent: mathAgent,
    schema: schemas.mathOutput,
    task: (input: z.infer<typeof schemas.mathInput>) => 
      `Use the add tool to add these numbers: ${input.a} and ${input.b}`
  }),

  multiply: createTask({
    name: 'Multiply Numbers',
    description: 'Multiplies two numbers together',
    agent: mathAgent,
    schema: schemas.mathOutput,
    task: (input: z.infer<typeof schemas.mathInput>) => 
      `Use the multiply tool to multiply these numbers: ${input.a} and ${input.b}`
  }),

  toWords: createTask({
    name: 'Numbers to Words',
    description: 'Converts a number to its word representation',
    agent: mathAgent,
    schema: z.string(),
    task: (input: z.infer<typeof schemas.numbersToWords>) => 
      `convert this number to its word representation: ${input.number}`
  })
}; 