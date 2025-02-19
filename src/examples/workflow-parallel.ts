import { createWorkflow } from '../core/workflow';
import { z } from 'zod';
import { createAgent } from '../core/agent';
import { createTask } from '../core/task';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Tool } from 'ai';
import type { TaskExecutor } from '../core/workflow';
import chalk from 'chalk';

// Initialize OpenRouter
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Define our tools
const addTool: Tool = {
  description: 'Add two numbers together',
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ a, b }) => {
    console.log(chalk.blue(`🔢 Adding numbers: ${a} + ${b}`));
    return {
      content: [{
        type: 'text',
        text: `${a + b}`
      }]
    };
  }
};

const multiplyTool: Tool = {
  description: 'Multiply two numbers together',
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ a, b }) => {
    console.log(chalk.blue(`🔢 Multiplying numbers: ${a} × ${b}`));
    return {
      content: [{
        type: 'text',
        text: `${a * b}`
      }]
    };
  }
};

// Create an agent for our math operations
const mathAgent = createAgent({
  name: 'Math Agent',
  description: 'An agent that performs mathematical operations',
  role: 'You are a mathematical computation agent that performs precise calculations. Always use the provided tools for calculations.',
  model: openrouter.chat('anthropic/claude-3.5-sonnet'),
  tools: {
    add: addTool,
    multiply: multiplyTool
  }
});

// Define our input/output schemas
const mathInputSchema = z.object({
  a: z.number(),
  b: z.number()
});

const mathOutputSchema = z.number();

// Define our task executors as proper Task instances
const addNumbersTask = createTask({
  name: 'Add Numbers',
  description: 'Adds two numbers together',
  agent: mathAgent,
  outputSchema: mathOutputSchema,
  task: (input: z.infer<typeof mathInputSchema>) => 
    `Use the add tool to add these numbers: ${input.a} and ${input.b}`
});

const multiplyNumbersTask = createTask({
  name: 'Multiply Numbers',
  description: 'Multiplies two numbers together',
  agent: mathAgent,
  outputSchema: mathOutputSchema,
  task: (input: z.infer<typeof mathInputSchema>) => 
    `Use the multiply tool to multiply these numbers: ${input.a} and ${input.b}`
});

const numbersToWordsSchema = z.object({
  number: z.number()
});

const numbersToWordsTask = createTask({
  name: 'Numbers to Words',
  description: 'Converts a number to its word representation',
  agent: mathAgent,
  outputSchema: z.string(),
  task: (input: z.infer<typeof numbersToWordsSchema>) => 
    `convert this number to its word representation: ${input.number}`
});

// Create task executor wrappers that match the TaskExecutor interface
const addNumbers: TaskExecutor<z.infer<typeof mathInputSchema>, number> = 
  async (input) => {
    console.log(chalk.yellow(`📝 Starting addition task: ${input.a} + ${input.b}`));
    const result = Number(await addNumbersTask.run(input));
    console.log(chalk.green(`✅ Addition complete: ${result}`));
    return result;
  };

const multiplyNumbers: TaskExecutor<z.infer<typeof mathInputSchema>, number> = 
  async (input) => {
    console.log(chalk.yellow(`📝 Starting multiplication task: ${input.a} × ${input.b}`));
    const result = Number(await multiplyNumbersTask.run(input));
    console.log(chalk.green(`✅ Multiplication complete: ${result}`));
    return result;
  };

const numbersToWords: TaskExecutor<z.infer<typeof numbersToWordsSchema>, string> = 
  async (input) => {
    console.log(chalk.yellow(`📝 Starting number to words conversion: ${input.number}`));
    const result = await numbersToWordsTask.run(input);
    console.log(chalk.green(`✅ Conversion complete: "${result}"`));
    return result;
  };

// Define our workflow output schema
const mathResultSchema = z.object({
  firstSum: z.number(),
  secondSum: z.number(),
  finalProduct: z.number(),
  inWords: z.string()
});

type MathResult = z.infer<typeof mathResultSchema>;

async function main() {
  console.log(chalk.cyan('\n🚀 Starting parallel math workflow\n'));

  // Create our workflow
  const mathWorkflow = createWorkflow<{ pairs: [number, number][] }>({
    name: 'Parallel Math Operations',
    description: 'Performs two additions in parallel and multiplies their results',
    onTaskStart: (taskName) => {
      console.log(chalk.magenta(`⚡ Starting task: ${taskName}`));
    },
    onTaskComplete: (taskName, result) => {
      console.log(chalk.magenta(`🏁 Completed task: ${taskName}`));
      console.log(chalk.gray(`   Result: ${JSON.stringify(result)}\n`));
    }
  }, async (w) => {
    console.log(chalk.cyan('📊 Executing parallel additions...'));
    
    // Execute addition tasks in parallel
    const [firstSum, secondSum] = await w.parallel([
      {
        name: 'First Addition',
        task: addNumbers,
        input: { 
          a: w.input.pairs[0][0], 
          b: w.input.pairs[0][1] 
        }
      },
      {
        name: 'Second Addition',
        task: addNumbers,
        input: { 
          a: w.input.pairs[1][0], 
          b: w.input.pairs[1][1] 
        }
      }
    ]);

    console.log(chalk.cyan('\n📊 Multiplying results...'));

    // Multiply the results
    const finalProduct = await w.task(
      'Multiply Results',
      multiplyNumbers,
      { a: firstSum, b: secondSum }
    );

    console.log(chalk.cyan('\n📊 Converting to words...'));

    // Convert to words
    const inWords = await w.task(
      'In Words',
      numbersToWords,
      { number: finalProduct }
    );

    // Return the final result
    return {
      firstSum,
      secondSum,
      finalProduct,
      inWords
    };
  });

  // Execute the workflow with some test numbers
  const input = {
    pairs: [
      [3, 4] as [number, number],   // 3 + 4 = 7
      [5, 6] as [number, number]    // 5 + 6 = 11
    ]           // 7 * 11 = 77
  };

  console.log(chalk.cyan('📥 Input:'));
  console.log(chalk.gray(`   First pair: ${input.pairs[0][0]} + ${input.pairs[0][1]}`));
  console.log(chalk.gray(`   Second pair: ${input.pairs[1][0]} + ${input.pairs[1][1]}\n`));

  const result = await mathWorkflow.run(input, {
    schema: mathResultSchema
  });

  console.log(chalk.cyan('\n📊 Final Results:'));
  console.log(chalk.gray(`   First addition: ${input.pairs[0][0]} + ${input.pairs[0][1]} = ${result.firstSum}`));
  console.log(chalk.gray(`   Second addition: ${input.pairs[1][0]} + ${input.pairs[1][1]} = ${result.secondSum}`));
  console.log(chalk.gray(`   Final multiplication: ${result.firstSum} × ${result.secondSum} = ${result.finalProduct}`));
  console.log(chalk.gray(`   In words: ${result.inWords}\n`));
}

// Run the example if this file is executed directly
main()
