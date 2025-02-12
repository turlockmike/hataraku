import chalk from 'chalk';
import { mathTasks } from './agents/math';

async function main() {
  console.log(chalk.cyan('\n🚀 Starting math operations\n'));

  try {
    // Input values
    const firstPair = [3, 4];
    const secondPair = [5, 6];

    console.log(chalk.cyan('📥 Input:'));
    console.log(chalk.gray(`   First pair: ${firstPair[0]} + ${firstPair[1]}`));
    console.log(chalk.gray(`   Second pair: ${secondPair[0]} + ${secondPair[1]}\n`));

    // Perform additions in parallel
    console.log(chalk.cyan('📊 Executing parallel additions...'));
    const [firstSum, secondSum] = await Promise.all([
      mathTasks.add.execute({ a: firstPair[0], b: firstPair[1] }),
      mathTasks.add.execute({ a: secondPair[0], b: secondPair[1] })
    ].map(p => p.then(Number)));

    console.log(chalk.cyan('\n📊 Multiplying results...'));
    const finalProduct = Number(await mathTasks.multiply.execute({ 
      a: firstSum, 
      b: secondSum 
    }));

    console.log(chalk.cyan('\n📊 Converting to words...'));
    const inWords = await mathTasks.toWords.execute({ 
      number: finalProduct 
    });

    // Display results
    console.log(chalk.cyan('\n📊 Final Results:'));
    console.log(chalk.gray(`   First addition: ${firstPair[0]} + ${firstPair[1]} = ${firstSum}`));
    console.log(chalk.gray(`   Second addition: ${secondPair[0]} + ${secondPair[1]} = ${secondSum}`));
    console.log(chalk.gray(`   Final multiplication: ${firstSum} × ${secondSum} = ${finalProduct}`));
    console.log(chalk.gray(`   In words: ${inWords}\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main();
} 