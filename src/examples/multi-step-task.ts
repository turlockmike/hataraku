import { Agent } from '../core-old/agent';
import { AgentConfig } from '../core-old/agent/types/config';
import { HatarakuTool } from '../lib/types';

// Create a multiplication tool
const multiplyTool: HatarakuTool = {
  name: 'multiply',
  description: 'Multiply two numbers together',
  inputSchema: {
    type: 'object',
    properties: {
      a: { type: 'number', description: 'The first number to multiply' },
      b: { type: 'number', description: 'The second number to multiply' }
    },
    required: ['a', 'b'],
    additionalProperties: false
  },
  execute: async (params: { a: number; b: number }) => {
    return {
      content: [{
        type: 'text',
        text: `${params.a * params.b}`
      }]
    };
  }
};

async function main() {
  // Get numbers from command line arguments or use defaults
  const num1 = Number(process.argv[2]) || 7;
  const num2 = Number(process.argv[3]) || 6;

  // Create agent config with multiplication tool
  const config: AgentConfig = {
    name: 'Multi-step Task Agent',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'deepseek/deepseek-chat'
    },
    tools: [multiplyTool],
    role: "You are a helpful assistant that can perform calculations and convert numbers to words.",
    customInstructions: "When converting numbers to words, use standard English number words (e.g., 'forty-two' for 42)."
  };

  // Create and initialize agent
  const agent = new Agent(config);
  agent.initialize();

  // Create task input with streaming enabled to see the step-by-step process
  const task = {
    role: 'user' as const,
    content: `Please multiply ${num1} and ${num2}, then convert the result to words. For example, if the result is 42, convert it to "forty-two".`,
    stream: true as const
  };

  try {
    console.log(`\nMultiplying ${num1} × ${num2} and converting to words...\n`);
    
    const result = await agent.task(task);

    // Print each chunk as it comes in
    for await (const chunk of result.stream) {
      process.stdout.write(chunk);
    }

    // Print final metadata
    console.log('\n\nTask completed!');
    console.log('metadata:', await result.metadata);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error); 