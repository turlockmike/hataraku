import chalk from 'chalk';
import * as path from 'path';
import { analyzeFileTask } from './agents/jsdoc';
import { findNestedExports } from '../src/experimental/analyzer/export-analyzer';

async function main() {
  // Get file path from command line arguments
  const targetFile = process.argv[2];
  
  // Check if target file is provided
  if (!targetFile) {
    console.error(chalk.red('\n❌ Error: Target file is required'));
    showUsage();
    process.exit(1);
  }
  
  console.log(chalk.cyan('\n📝 JSDoc Generator\n'));
  
  
  try {
    // Initialize tasks
    console.log(chalk.cyan(`📊 Analyzing file: ${targetFile}`));
    
    // Use export analyzer to find exported functions
    const absolutePath = path.resolve(process.cwd(), targetFile);
    const exportedItems = await findNestedExports(absolutePath);
    
    // Filter for functions only
    const exportedFunctions = exportedItems.filter(item => item.kind === 'function');
    
    console.log(chalk.gray(`   Found ${exportedFunctions.length} exported functions`));
    
    // Analyze the file with the JSDoc tasks
    console.log(chalk.gray(`   Running JSDoc analysis...`));
    
    const result = await analyzeFileTask.run({ filePath: targetFile, exportedFunctions }, {verbose: true});
    console.log(chalk.green(`   ✅ JSDoc comments added successfully\n`));
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    console.error(chalk.yellow('\nNote: This example requires Google Cloud authentication.'));
    console.error(chalk.yellow('Make sure you have set up the GOOGLE_APPLICATION_CREDENTIALS environment variable'));
    console.error(chalk.yellow('or other Google Cloud authentication method.'));
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log(chalk.cyan('\n📝 JSDoc Generator\n'));
  console.log(chalk.gray('Usage:'));
  console.log(chalk.gray('  npx tsx examples/jsdoc-generator.ts <file-path>'));
  console.log(chalk.gray('\nExamples:'));
  console.log(chalk.gray('  npx tsx examples/jsdoc-generator.ts src/core/index.ts'));
  console.log(chalk.gray('  npx tsx examples/jsdoc-generator.ts src/utils/export-analyzer.ts'));
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the example
main().catch(console.error);