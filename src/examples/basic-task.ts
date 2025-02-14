import chalk from 'chalk';
import { greeterTasks } from './agents/greeter';

async function main() {
  console.log(chalk.cyan('\n👋 Basic Task Example\n'));

  try {
    // Input
    const name = 'Alice';
    console.log(chalk.cyan('📥 Input:'));
    console.log(chalk.gray(`   Name: ${name}\n`));

    // Generate greeting
    console.log(chalk.cyan('🤖 Generating greeting...'));
    const greeting = await greeterTasks.greet.execute({ name });

    // Display result
    console.log(chalk.cyan('\n📤 Result:'));
    console.log(chalk.gray(`   ${greeting}\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
main()