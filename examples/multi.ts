import { Tool } from 'ai'
import { z } from 'zod'
import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base'

// Create a multiplication tool
const multiplyTool: Tool = {
  description: 'Multiply two numbers together',
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ a, b }) => {
    return {
      content: [
        {
          type: 'text',
          text: `${a * b}`,
        },
      ],
    }
  },
}

async function main() {
  // Get numbers from command line arguments or use defaults
  const num1 = Number(process.argv[2]) || 7
  const num2 = Number(process.argv[3]) || 6

  // Create agent with multiplication tool
  const agent = await createBaseAgent({
    name: 'Multi-step Task Agent',
    role: ROLES.CALCULATOR,
    description: DESCRIPTIONS.CALCULATOR,
    tools: {
      multiply: multiplyTool,
    },
  })

  try {
    console.log(`\nMultiplying ${num1} × ${num2} and converting to words...\n`)

    const result = await agent.task(
      `Please multiply ${num1} and ${num2}, then convert the result to words. For example, if the result is 42, convert it to "forty-two".`,
      { stream: true },
    )

    // Print each chunk as it comes in
    for await (const chunk of result) {
      process.stdout.write(chunk)
    }

    // Print final metadata
    console.log('\n\nTask completed!')
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the program
main().catch(console.error)
