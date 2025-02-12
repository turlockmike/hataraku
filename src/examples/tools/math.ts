import { Tool } from 'ai';
import { z } from 'zod';
import chalk from 'chalk';

export const addTool: Tool = {
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

export const multiplyTool: Tool = {
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