import { HatarakuTool } from "../lib/types";
import { Agent } from '../core/agent';
import { AgentConfig, TaskInput } from '../core/agent/types/config';
import chalk from "chalk";

// A simple Fibonacci calculator tool
export const fibonacciTool: HatarakuTool = {
  name: "fibonacci",
  description: "Calculates the nth Fibonacci number. Provide n (a positive integer) and returns the nth Fibonacci number.",
  inputSchema: {
    type: "object",
    properties: {
      n: {
        type: "number",
        description: "The position (1-indexed) of the Fibonacci number to calculate. Must be a positive integer."
      }
    },
    required: ["n"],
    additionalProperties: false
  },
  execute: async ({ n }: { n: number }) => {
    if (n <= 0 || !Number.isInteger(n)) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: "Invalid input. 'n' must be a positive integer."
        }]
      };
    }
    // Fibonacci calculation (1-indexed: fibonacci(1)=1, fibonacci(2)=1, etc.)
    function fibonacci(num: number): number {
      if (num <= 2) {return 1;}
      let a = 1, b = 1, temp = 0;
      for (let i = 3; i <= num; i++) {
        temp = a + b;
        a = b;
        b = temp;
      }
      return b;
    }
    const result = fibonacci(n);
    console.debug(chalk.gray(`Fibonacci calculated number ${n} is ${result}`));
    return {
      content: [{
        type: "text",
        text: `Fibonacci number ${n} is ${result}`
      }]
    };
  }
}; 

// Demo usage of the fibonacci tool
async function main() {
  // Get n from command line arguments, default to 10 if not provided
  const n = parseInt(process.argv[2]) || 10;

  // Create agent config with OpenRouter/Sonnet model and our fibonacci tool
  const config: AgentConfig = {
    name: 'Fibonacci Calculator Agent',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'deepseek/deepseek-chat'
    },
    tools: [fibonacciTool]
  };

  // Create and initialize agent
  const agent = new Agent(config);

  // Create task input asking for the nth Fibonacci number
  const task = {
    role: 'user' as const,
    content: `Calculate the ${n}th Fibonacci number`,
  };

  try {
    console.log(`\nCalculating the ${n}th Fibonacci number...\n`);
    const response = await agent.task(task);
    console.log('Response:');
    console.log(await response.content);
    console.log('\nMetadata:', await response.metadata);
    console.log(); // Add newline at end
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 