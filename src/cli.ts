#!/usr/bin/env node

import { buildApiHandler } from './api';
import { CliToolExecutor } from './lib/tools/CliToolExecutor';
import { CliMessageParser } from './lib/parser/CliMessageParser';
import { openRouterDefaultModelInfo, deepSeekModels } from './shared/api';
import { McpClient } from './lib/mcp/McpClient';
import { TaskLoop } from './core/task-loop';
import { TaskHistory } from './core/TaskHistory';
import chalk from 'chalk';
import { Command } from 'commander';
import * as os from 'os';
import * as path from 'path';
import { input } from '@inquirer/prompts';
const program = new Command();

program
    .name('cline')
    .description('CLI version of Cline AI assistant - An autonomous coding agent')
    .option('-p, --provider <provider>', 'API provider to use (openrouter, anthropic, openai)', 'openRouter')
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet:beta, deepseek/deepseek-chat)', 'anthropic/claude-3.5-sonnet:beta')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-a, --max-attempts <number>', 'Maximum number of consecutive mistakes before exiting (default: 3)')
    .option('-l, --list-history', 'List recent tasks from history')
    .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
    .argument('[task]', 'Task or question for the AI assistant')
    .version('1.0.0')
    .addHelpText('after', `
Examples:
  $ cline "create a hello world html file"                                # Uses default model (claude-3.5-sonnet:beta)
  $ cline --model deepseek/deepseek-chat "explain this code"             # Uses different model
  $ cline --provider anthropic --model claude-3 "write a test"           # Uses different provider
  $ OPENROUTER_API_KEY=<key> cline "write a test file"                  # Provides API key via env var
  $ cline -i                                                             # Run in interactive mode
  $ cline -i "initial task"                                              # Interactive mode with initial task

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI

Output:
  - Results are shown in green
  - Usage information in yellow
  - "thinking..." indicator shows when processing

Task History:
  - Tasks are saved in ~/.config/cline/tasks/
  - Use --list-history to view recent tasks
  - Each task includes:
    * Task ID and timestamp
    * Input/output tokens
    * Cost information
    * Full conversation history`);

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
            apiProvider: options.provider.toLowerCase(),
            [`${options.provider}ApiKey`]: apiKey,
            ...(options.model && {
                [`${options.provider}ModelId`]: options.model,
                [`${options.provider}ModelInfo`]: options.model.startsWith('deepseek/')
                    ? deepSeekModels['deepseek-chat']
                    : openRouterDefaultModelInfo
            })
        });

        const toolExecutor = new CliToolExecutor(process.cwd());
        const messageParser = new CliMessageParser();
        const mcpClient = new McpClient();

        // Initialize TaskHistory
        const taskHistory = new TaskHistory();

        // Handle history listing
        if (options.listHistory) {
            const tasks = await taskHistory.listTasks();
            console.log(chalk.yellow(`Task history location: ${path.join(os.homedir(), '.config', 'cline', 'tasks')}\n`));
            if (tasks.length === 0) {
                console.log('No task history found.');
            } else {
                console.log('Recent tasks:');
                for (const task of tasks) {
                    const date = new Date(task.timestamp).toLocaleString();
                    console.log(chalk.green(`${task.taskId} (${date}):`));
                    console.log(`  ${task.task}\n`);
                }
            }
            process.exit(0);
        }

        // Initialize task loop
        const taskLoop = new TaskLoop(
            apiHandler,
            toolExecutor,
            mcpClient,
            messageParser,
            parseInt(options.maxAttempts),
            options.interactive
        );

        if (options.interactive) {
            // Interactive mode
            
            async function promptForTask() {
                const newTask = await input({
                    message: 'Enter your task, or type "exit" to quit:',
                    default: task // Use provided task argument as default if available
                });

                if (newTask === 'exit') {
                    console.log(chalk.yellow('Exiting interactive mode.'));
                    process.exit(0);
                }

                if (newTask) {
                    await taskLoop.run(newTask);
                    // Prompt for next task
                    await promptForTask();
                }
            }

            await promptForTask();
        } else {
            // Normal mode
            if (!task) {
                console.error(chalk.red('Error: Please provide a task or question'));
                program.help();
            }
            await taskLoop.run(task);
        }

    } catch (error) {
        console.error(chalk.red('Error:'), error);
        console.error(chalk.yellow('\nDebug Information:'));
        console.error(chalk.yellow(`Provider: ${program.opts().provider}`));
        console.error(chalk.yellow(`Model: ${program.opts().model}`));
        process.exit(1);
    }
}

main().catch(console.error);