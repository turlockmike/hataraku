import * as path from 'path';
import chalk from 'chalk';
import { findNestedExports } from '../src/experimental/analyzer/export-analyzer';

async function main() {
  console.log(chalk.cyan('\n📊 Export Analyzer Example - Nested Exports Analysis\n'));
  
  // Files to analyze
  const filePaths = [
    path.resolve(__dirname, '../src/core/index.ts'),
  ];
  
  for (const filePath of filePaths) {
    console.log(chalk.yellow(`\nAnalyzing file: ${filePath}\n`));
    
    try {
      // Find all exported items with nested analysis
      const nestedExports = await findNestedExports(filePath);
      console.log('RAW',nestedExports);
      
      if (nestedExports.length === 0) {
        console.log(chalk.gray('   No named exports found'));
      } else {
        // Group by source module for better organization
        const groupedBySource = nestedExports.reduce((acc, item) => {
          const source = item.originalSource || item.source;
          if (!acc[source]) {
            acc[source] = [];
          }
          acc[source].push(item);
          return acc;
        }, {} as Record<string, typeof nestedExports>);
        
        // Display exports grouped by source
        Object.entries(groupedBySource).forEach(([source, items]) => {
          console.log(chalk.yellow(`\nFrom ${source} (${items.length}):`));
          items.forEach(item => {
            console.log(chalk.cyan(`- ${item.name}${item.kind ? ` (${item.kind})` : ''}`));
            if (item.originalSource && item.source !== item.originalSource) {
              console.log(chalk.gray(`  Re-exported through: ${item.source}`));
            }
            if (item.documentation) {
              console.log(chalk.gray(`  Documentation: ${item.documentation}`));
            }
          });
        });
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error analyzing file: ${error}`));
    }
  }
  
  console.log(chalk.green('\n✅ Analysis complete!'));
}

// Run the example
main().catch(console.error); 