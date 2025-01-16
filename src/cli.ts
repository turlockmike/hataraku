#!/usr/bin/env node

import { buildApiHandler } from './api';
import { CliToolExecutor } from './lib/tools/CliToolExecutor';
import { CliMessageParser } from './lib/parser/CliMessageParser';
import { McpClient } from './lib/mcp/McpClient';
import { TaskLoop } from './core/task-loop';
import chalk from 'chalk';
import { Command } from 'commander';

const program = new Command();

program
    .name('cline')
    .description('CLI version of Cline AI assistant - An autonomous coding agent')
    .option('-p, --provider <provider>', 'API provider to use (openrouter, anthropic, openai)', 'openrouter')
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet:beta, deepseek/deepseek-chat)', 'anthropic/claude-3.5-sonnet:beta')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-a, --max-attempts <number>', 'Maximum number of consecutive mistakes before exiting (default: 3)')
    .argument('[task]', 'Task or question for the AI assistant')
    .version('1.0.0')
    .addHelpText('after', `
Examples:
  $ cline "create a hello world html file"                                # Uses default model (claude-3.5-sonnet:beta)
  $ cline --model deepseek/deepseek-chat "explain this code"             # Uses different model
  $ cline --provider anthropic --model claude-3 "write a test"           # Uses different provider
  $ OPENROUTER_API_KEY=<key> cline "write a test file"                  # Provides API key via env var

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI

Output:
  - Results are shown in green
  - Usage information in yellow
  - "thinking..." indicator shows when processing`);

async function main() {
    try {
        program.parse();
        const options = program.opts();
        const task = program.args[0];

        // Check for API key
        const apiKey = options.apiKey || process.env[`${options.provider.toUpperCase()}_API_KEY`];
        if (!apiKey) {
            console.error(chalk.red(`Error: API key required. Provide via --api-key or ${options.provider.toUpperCase()}_API_KEY env var`));
            process.exit(1);
        }

        // Initialize components
        const apiHandler = buildApiHandler({
            apiProvider: options.provider,
            [`${options.provider}ApiKey`]: apiKey,
            ...(options.model && { [`${options.provider}ModelId`]: options.model })
        });

        const toolExecutor = new CliToolExecutor(process.cwd());
        const messageParser = new CliMessageParser();
        const mcpClient = new McpClient();

        // Check for task
        if (!task) {
            console.error(chalk.red('Error: Please provide a task or question'));
            program.help();
        }

        // Start the task loop
        const taskLoop = new TaskLoop(
            apiHandler,
            toolExecutor,
            mcpClient,
            messageParser,
            parseInt(options.maxAttempts)
        );
        await taskLoop.run(task);

    } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
    }
}

main().catch(console.error);