import { Tool } from 'ai'
import { z } from 'zod'
import chalk from 'chalk'
import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base'

// A simple Fibonacci calculator tool
export const fibonacciTool: Tool = {
  description:
    'Calculates the nth Fibonacci number. Provide n (a positive integer) and returns the nth Fibonacci number.',
  parameters: z.object({
    n: z
      .number()
      .describe('The position (1-indexed) of the Fibonacci number to calculate. Must be a positive integer.')
      .int()
      .positive(),
  }),
  execute: async ({ n }) => {
    if (n <= 0 || !Number.isInteger(n)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: "Invalid input. 'n' must be a positive integer.",
          },
        ],
      }
    }
    // Fibonacci calculation (1-indexed: fibonacci(1)=1, fibonacci(2)=1, etc.)
    function fibonacci(num: number): number {
      if (num <= 2) {
        return 1
      }
      let a = 1,
        b = 1,
        temp = 0
      for (let i = 3; i <= num; i++) {
        temp = a + b
        a = b
        b = temp
      }
      return b
    }
    const result = fibonacci(n)
    console.debug(chalk.gray(`Fibonacci calculated number ${n} is ${result}`))
    return {
      content: [
        {
          type: 'text',
          text: `Fibonacci number ${n} is ${result}`,
        },
      ],
    }
  },
}

// Demo usage of the fibonacci tool
async function main() {
  // Get n from command line arguments, default to 10 if not provided
  const n = parseInt(process.argv[2]) || 30

  // Create agent with our fibonacci tool
  const agent = await createBaseAgent({
    name: 'Calculator Agent',
    role: 'You are a helpful assistant that can calculate the nth Fibonacci number. Use the tools to do any calculations.',
    description: 'A helpful assistant that can calculate the nth Fibonacci number.',
    tools: {
      fibonacci: fibonacciTool,
    },
  })

  try {
    console.log(`\nCalculating the ${n}th Fibonacci number...\n`)
    const response = await agent.task(`Calculate the ${n}th Fibonacci number`)
    console.log('Response:')
    for await (const chunk of response) {
      process.stdout.write(chunk)
    }
    console.log() // Add newline at end
  } catch (error) {
    console.error('Error:', error)
  }
}

main()
