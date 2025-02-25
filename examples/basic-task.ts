import chalk from 'chalk';
import { createTask } from '../core/task';
import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base';
import { z } from 'zod';

// Initialize agent and tasks
const initializeTasks = async () => {
  // Create a simple greeter agent using our base configuration
  const greeterAgent = createBaseAgent({
    name: 'Greeter Agent',
    description: DESCRIPTIONS.GREETER,
    role: ROLES.GREETER
  });

  // Tasks
  return {
    greet: createTask({
      name: 'Generate Greeting',
      description: 'Generates a friendly greeting for a given name',
      agent: greeterAgent,
      inputSchema: z.object({ name: z.string() }),
      task: (input: { name: string }) => 
        `Generate a warm and friendly greeting for ${input.name}. Keep it simple and direct.`
    })
  };
};

async function main(name: string) {
  console.log(chalk.cyan('\n👋 Basic Task Example\n'));

  try {
    // Initialize tasks
    const greeterTasks = await initializeTasks();
    
    // Input
    console.log(chalk.cyan('📥 Input:'));
    console.log(chalk.gray(`   Name: ${name}\n`));

    // Generate greeting
    console.log(chalk.cyan('🤖 Generating greeting...'));
    const greeting = await greeterTasks.greet.run({ name });

    // Display result
    console.log(chalk.cyan('\n📤 Result:'));
    console.log(chalk.gray(`   ${greeting}\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
main(process.argv[2] || 'Extend');