#!/usr/bin/env node

import { modelProviderFromConfig } from './api';
import { CliToolExecutor } from './lib/tools/CliToolExecutor';
import { CliMessageParser } from './lib/parser/CliMessageParser';
import { openRouterDefaultModelInfo, deepSeekModels } from './shared/api';
import { McpClient } from './lib/mcp/McpClient';
import { TaskLoop } from './core-old/task-loop';
import { TaskHistory } from './core-old/TaskHistory';
import chalk from 'chalk';
import { Command } from 'commander';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { input, select } from '@inquirer/prompts';
import { playAudioTool } from './lib/tools/play-audio';
import { version } from '../package.json';
import { startServer } from './server';

const program = new Command();

// Add serve command first
program
    .command('serve')
    .description('Start the web interface')
    .option('-p, --port <number>', 'Port to run the server on', '3000')
    .action(async (options) => {
        const port = parseInt(options.port);
        const apiKey = program.opts().apiKey || process.env[`${program.opts().provider.toUpperCase()}_API_KEY`];
        
        if (!apiKey) {
            console.error(chalk.red(`Error: API key required. Provide via --api-key or ${program.opts().provider.toUpperCase()}_API_KEY env var`));
            process.exit(1);
        }

        try {
            await startServer(port, apiKey, program.opts().provider.toLowerCase(), program.opts().model);
        } catch (error) {
            console.error(chalk.red('Error starting server:'), error);
            process.exit(1);
        }
    });

// Add default command
program
    .name('hataraku')
    .description('Hataraku is a CLI tool for creating and managing tasks')
    .option('--update', 'Update Hataraku to the latest version')
    .option('-p, --provider <provider>', 'API provider to use (openrouter, anthropic, openai)', 'openRouter')
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet:beta, deepseek/deepseek-chat)', 'anthropic/claude-3.5-sonnet')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-a, --max-attempts <number>', 'Maximum number of consecutive mistakes before exiting (default: 3)')
    .option('-l, --list-history', 'List recent tasks from history')
    .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
    .option('--no-sound', 'Disable sound effects')
    .argument('[task]', 'Task or question for the AI assistant')
    .version(version)
    .addHelpText('after', `
Examples:
  $ hataraku "create a hello world html file"                                # Uses default model (claude-3.5-sonnet:beta)
  $ hataraku --model deepseek/deepseek-chat "explain this code"             # Uses different model
  $ hataraku --provider anthropic --model claude-3 "write a test"           # Uses different provider
  $ OPENROUTER_API_KEY=<key> hataraku "write a test file"                  # Provides API key via env var
  $ hataraku -i                                                             # Run in interactive mode
  $ hataraku -i "initial task"                                              # Interactive mode with initial task
  $ hataraku --no-sound "create a test file"                               # Run without sound effects
  $ hataraku --update                                                       # Update Hataraku to the latest version
  $ hataraku serve                                                          # Start web interface

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI

Output:
  - Results are shown in green
  - Usage information in yellow
  - "thinking..." indicator shows when processing

Task History:
  - Tasks are saved in ~/.hataraku/logs/
  - Use --list-history to view recent tasks
  - Each task includes:
    * Task ID and timestamp
    * Input/output tokens
    * Cost information
    * Full conversation history`)
    .action(async (task) => {
        await main(task);
    });

async function promptForNextTask(followUpTasks: string[], defaultTask?: string): Promise<string | null> {
    // Create choices array with follow-up tasks and additional options
    const choices = [
        ...followUpTasks.map((task, index) => ({
            value: task, // Use the actual task text as the value
            label: task,
            description: `Follow-up task ${index + 1}`
        })),
        { value: 'write_own', label: 'Write my own', description: 'Enter a custom task' },
        { value: 'quit', label: 'Exit', description: 'Exit the program' }
    ];

    const choice = await select({
        message: 'Choose your next task:',
        choices
    });

    if (choice === 'quit') {
        console.log(chalk.yellow('Exiting...'));
        process.exit(0);
    }

    if (choice === 'write_own') {
        const customTask = await input({
            message: 'Enter your task:',
            default: defaultTask
        });
        return customTask || null;
    }

    // Since we're using the actual task text as the value, we can return it directly
    return choice;
}

async function main(task?: string) {
    try {
        const options = program.opts();

        // Handle update flag
        if (options.update) {
            console.log(chalk.yellow('Checking for updates...'));
            try {
                // Use npm to update the package globally
                execSync('npm install -g hataraku@latest', { stdio: 'inherit' });
                console.log(chalk.green('Successfully updated Hataraku to the latest version!'));
                process.exit(0);
            } catch (error) {
                console.error(chalk.red('Error updating Hataraku:'), error);
                console.log(chalk.yellow('Try running with sudo if you get permission errors.'));
                process.exit(1);
            }
        }

        // Check for API key
        const apiKey = options.apiKey || process.env[`${options.provider.toUpperCase()}_API_KEY`];
        if (!apiKey) {
            console.error(chalk.red(`Error: API key required. Provide via --api-key or ${options.provider.toUpperCase()}_API_KEY env var`));
            process.exit(1);
        }

        // Initialize components
        const apiHandler = modelProviderFromConfig({
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
            console.log(chalk.yellow(`Task history location: ${path.join(os.homedir(), '.hataraku', 'logs')}\n`));
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
            options.interactive,
            process.cwd(),
            { sound: options.sound }
        );

        if (options.interactive) {
            // Interactive mode
            async function runInteractiveTask(currentTask?: string) {
                let taskToRun = currentTask;

                if (!taskToRun) {
                    taskToRun = await input({
                        message: 'Enter your task, or type "exit" to quit:',
                        default: task // Use provided task argument as default if available
                    });

                    if (taskToRun === 'exit') {
                        console.log(chalk.yellow('Exiting interactive mode.'));
                        process.exit(0);
                    }
                }

                if (taskToRun) {
                    const result = await taskLoop.run(taskToRun);
                    // Play celebration sound if sounds are enabled
                    if (options.sound) {
                        await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
                    }

                    // Handle follow-up tasks if they exist
                    if (result.followUpTasks && result.followUpTasks.length > 0) {
                        const nextTask = await promptForNextTask(result.followUpTasks);
                        if (nextTask) {
                            await runInteractiveTask(nextTask);
                            return;
                        }
                    }

                    // If no follow-up tasks or user didn't select one, prompt for new task
                    await runInteractiveTask();
                }
            }

            await runInteractiveTask(task);
        } else {
            // Normal mode
            if (!task) {
                console.error(chalk.red('Error: Please provide a task or question'));
                program.help();
            }
            await taskLoop.run(task);
            // Play celebration sound if sounds are enabled
            if (options.sound) {
                await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
            }
            process.exit(0);
        }

    } catch (error) {
        console.error(chalk.red('Error:'), error);
        console.error(chalk.yellow('\nDebug Information:'));
        console.error(chalk.yellow(`Provider: ${program.opts().provider}`));
        console.error(chalk.yellow(`Model: ${program.opts().model}`));
        process.exit(1);
    }
}

// Parse command line arguments
program.parse();