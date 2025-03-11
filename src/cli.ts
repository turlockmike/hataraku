#!/usr/bin/env node

import { program, main } from './cli/index';

// Only run the program if this file is being run directly
if (require.main === module) {
  // Parse command line arguments
  const args = program.parse();
  // If no arguments or a subcommand, don't run main

  const task = program.args[0];
  main(task, program).then((code) => {
    process.exit(code);
  }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for testing and programmatic use
export { program, main, runCLI } from './cli/index';