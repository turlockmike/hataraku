import chalk from 'chalk';
import { analyzerTasks } from './agents/analyzer';

async function main() {
  console.log(chalk.cyan('\n📊 Text Analysis Example (Tools + Schema)\n'));

  try {
    // Input
    const text = `
      Artificial intelligence has transformed the way we live and work. 
      From virtual assistants to autonomous vehicles, AI technologies are 
      becoming increasingly integrated into our daily lives. While these 
      advancements bring numerous benefits, they also raise important 
      ethical considerations about privacy, bias, and the future of human work.
    `;

    console.log(chalk.cyan('📥 Input Text:'));
    console.log(chalk.gray(`   ${text.trim().replace(/\n\s+/g, ' ')}\n`));

    // Analyze text using tools and schema validation
    console.log(chalk.cyan('🤖 Analyzing text...'));
    console.log(chalk.gray('   Using tools for word count, sentiment, and complexity analysis...'));
    const analysis = await analyzerTasks.analyze.execute({ text });

    // Display structured results
    console.log(chalk.cyan('\n📤 Analysis Results:'));
    console.log(chalk.gray('   Word Count:'), chalk.yellow(analysis.wordCount));
    console.log(chalk.gray('   Sentiment:'), chalk.yellow(analysis.sentiment));
    console.log(chalk.gray('   Top Themes:'));
    analysis.topThemes.forEach(theme => {
      console.log(chalk.gray('     •'), chalk.yellow(theme));
    });
    console.log(chalk.gray('   Complexity:'));
    console.log(chalk.gray('     • Level:'), chalk.yellow(analysis.complexity.level));
    console.log(chalk.gray('     • Score:'), chalk.yellow(analysis.complexity.score));
    console.log(chalk.gray('   Summary:'), chalk.yellow(analysis.summary), '\n');

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main();
} 