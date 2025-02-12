import { Agent } from '../core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Tool } from 'ai';
import { z } from 'zod';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Create a multiplication tool
const multiplyTool: Tool = {
  description: 'Multiply two numbers together',
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({  a, b }) => {
    return {
      content: [{
        type: 'text',
        text: `${a * b}`
      }]
    };
  }
};

async function main() {
  // Get numbers from command line arguments or use defaults
  const num1 = Number(process.argv[2]) || 7;
  const num2 = Number(process.argv[3]) || 6;

  // Create agent config with multiplication tool
  const config = {
    name: 'Multi-step Task Agent',
    model: openrouter.chat('anthropic/claude-3.5-sonnet'),
    tools: {
      multiply: multiplyTool
    },
    role: "You are a helpful assistant that can perform calculations and convert numbers to words. You will be given a task, only perform the task and remove unneccesary chatter",
    description: "You are a helpful assistant that can perform calculations and convert numbers to words."
  };

  // Create and initialize agent
  const agent = new Agent(config);

  try {
    console.log(`\nMultiplying ${num1} × ${num2} and converting to words...\n`);
    
    const result = await agent.task(`Please multiply ${num1} and ${num2}, then convert the result to words. For example, if the result is 42, convert it to "forty-two".`, {stream: true});

    // Print each chunk as it comes in
    for await (const chunk of result) {
      process.stdout.write(chunk);
    }

    // Print final metadata
    console.log('\n\nTask completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error); 