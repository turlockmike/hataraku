#!/usr/bin/env node

import { Command } from 'commander';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Agent } from './core/agent';
import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { version } from '../package.json';
import { startServer } from './server';
import { playAudioTool } from './lib/tools/play-audio';
import { ALL_TOOLS } from './core/tools';
import * as os from 'os';
import * as path from 'path';

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
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet)', 'anthropic/claude-3.5-sonnet')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
    .option('--no-sound', 'Disable sound effects')
    .option('--no-stream', 'Disable streaming responses')
    .argument('[task]', 'Task or question for the AI assistant')
    .version(version)
    .addHelpText('after', `
Examples:
  $ hataraku "create a hello world html file"                                # Uses default model (claude-3.5-sonnet)
  $ hataraku --model deepseek/deepseek-chat "explain this code"             # Uses different model
  $ hataraku --provider anthropic --model claude-3 "write a test"           # Uses different provider
  $ OPENROUTER_API_KEY=<key> hataraku "write a test file"                  # Provides API key via env var
  $ hataraku -i                                                             # Run in interactive mode
  $ hataraku -i "initial task"                                              # Interactive mode with initial task
  $ hataraku --no-sound "create a test file"                               # Run without sound effects
  $ hataraku --no-stream "explain this code"                               # Run without streaming responses
  $ hataraku serve                                                          # Start web interface

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI`)
    .action(async (task) => {
        // The task will be handled by main() after parsing
    });

async function promptForNextTask(followUpTasks: string[], defaultTask?: string): Promise<string | null> {
    const choices = [
        ...followUpTasks.map((task, index) => ({
            value: task,
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

    return choice;
}

async function main(task?: string) {
    try {
        const options = program.opts();

        // Check for API key
        const apiKey = options.apiKey || process.env[`${options.provider.toUpperCase()}_API_KEY`];
        if (!apiKey) {
            console.error(chalk.red(`Error: API key required. Provide via --api-key or ${options.provider.toUpperCase()}_API_KEY env var`));
            return 1;
        }

        // Initialize OpenRouter client
        const openrouter = createOpenRouter({
            apiKey,
        });

        // Initialize agent
        const agent = new Agent({
            name: 'Hataraku CLI Agent',
            description: 'A helpful AI assistant that can perform various tasks and answer questions',
            role: `You are a helpful AI assistant that can perform various tasks and answer questions.
                  You should be friendly but professional, and provide clear and concise responses.
                  When working with code, you should follow best practices and provide explanations.
                  You have access to various tools for working with files, executing commands, and more.
                  Use these tools when appropriate to help accomplish tasks.`,
            model: openrouter.chat(options.model),
            tools: ALL_TOOLS,
            callSettings: {
                temperature: 0.7,
                maxTokens: 2000,
            }
        });

        if (options.interactive) {
            // Interactive mode
            async function runInteractiveTask(currentTask?: string) {
                let taskToRun = currentTask;

                if (!taskToRun) {
                    taskToRun = await input({
                        message: 'Enter your task, or type "exit" to quit:',
                        default: task // Use provided task argument as default if available
                    });

                    if (!taskToRun || taskToRun === 'exit') {
                        console.log(chalk.yellow('Exiting interactive mode.'));
                        return 0;
                    }
                }

                console.log(chalk.blue('\nExecuting task:', taskToRun));
                
                try {
                    if (options.stream !== false) {
                        const result = await agent.task(taskToRun, { stream: true });
                        for await (const chunk of result) {
                            process.stdout.write(chunk);
                        }
                        console.log(); // Add newline at end
                    } else {
                        const result = await agent.task(taskToRun);
                        console.log(result);
                    }

                    // Play celebration sound if sounds are enabled
                    if (options.sound) {
                        await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
                    }

                    // Prompt for next task
                    return runInteractiveTask();
                } catch (error) {
                    console.error(chalk.red('Error executing task:'), error);
                    return runInteractiveTask();
                }
            }

            return runInteractiveTask(task);
        } else {
            // Normal mode
            if (!task) {
                console.error(chalk.red('Error: Please provide a task or question'));
                program.help();
                return 1;
            }

            console.log(chalk.blue('\nExecuting task:', task));

            try {
                if (options.stream !== false) {
                    const result = await agent.task(task, { stream: true });
                    for await (const chunk of result) {
                        process.stdout.write(chunk);
                    }
                    console.log(); // Add newline at end
                } else {
                    const result = await agent.task(task);
                    console.log('Task result:', result);
                }

                // Play celebration sound if sounds are enabled
                if (options.sound) {
                    await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
                }
                return 0;
            } catch (error) {
                console.error(chalk.red('Error executing task:'), error);
                return 1;
            }
        }
    } catch (error) {
        console.error(chalk.red('Error:'), error);
        console.error(chalk.yellow('\nDebug Information:'));
        console.error(chalk.yellow(`Provider: ${program.opts().provider}`));
        console.error(chalk.yellow(`Model: ${program.opts().model}`));
        return 1;
    }
}

// Only run the program if this file is being run directly
if (require.main === module) {
    // Parse command line arguments
    program.parse();
    const task = program.args[0];
    main(task).then((code) => {
        process.exit(code);
    }).catch((error) => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}

// Export for testing
export { program, main }; 