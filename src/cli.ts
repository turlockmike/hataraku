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
import { input, select } from '@inquirer/prompts';
import { playAudioTool } from './lib/tools/play-audio';
import { version } from '../package.json';
import { VoiceMonitor } from './services/voice/VoiceMonitor';
import { VoiceServiceState, VoiceCommandResult } from './services/voice/types';

const program = new Command();

program
    .name('hataraku')
    .description('Hataraku is a CLI tool for creating and managing tasks')
    .option('-p, --provider <provider>', 'API provider to use (openrouter, anthropic, openai)', 'openRouter')
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet:beta, deepseek/deepseek-chat)', 'anthropic/claude-3.5-sonnet')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-a, --max-attempts <number>', 'Maximum number of consecutive mistakes before exiting (default: 3)')
    .option('-l, --list-history', 'List recent tasks from history')
    .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
    .option('--no-sound', 'Disable sound effects')
    .option('-v, --voice', 'Enable voice command mode with "Hey Hataraku" wake word')
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
  $ hataraku --voice                                                        # Run with voice command support

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI

Output:
  - Results are shown in green
  - Usage information in yellow
  - "thinking..." indicator shows when processing
  - Voice command status shown when enabled

Task History:
  - Tasks are saved in ~/.config/hataraku/tasks/
  - Use --list-history to view recent tasks
  - Each task includes:
    * Task ID and timestamp
    * Input/output tokens
    * Cost information
    * Full conversation history`);

async function promptForNextTask(followUpTasks: string[], defaultTask?: string): Promise<string | null> {
    // Create choices array with follow-up tasks and additional options
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

async function initializeVoiceMonitor(taskLoop: TaskLoop): Promise<VoiceMonitor> {
    const voiceMonitor = new VoiceMonitor({
        wakeWord: 'Hey Hataraku',
        sensitivity: 0.5,
        enableLogging: true
    });

    // Handle voice commands
    voiceMonitor.setHandlers({
        onCommand: async (result: VoiceCommandResult) => {
            console.log(chalk.blue('\nProcessing voice command:', result.text));
            await taskLoop.run(result.text);
            if (program.opts().sound) {
                await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
            }
        },
        onStateChange: (state: VoiceServiceState) => {
            switch (state) {
                case VoiceServiceState.LISTENING:
                    console.log(chalk.blue('\nListening for "Hey Hataraku"...'));
                    break;
                case VoiceServiceState.PROCESSING:
                    console.log(chalk.blue('\nProcessing speech...'));
                    break;
                case VoiceServiceState.ERROR:
                    console.log(chalk.red('\nVoice processing error occurred'));
                    break;
            }
        },
        onError: (error: Error) => {
            console.error(chalk.red('\nVoice Error:'), error);
        }
    });

    try {
        await voiceMonitor.start();
        console.log(chalk.green('\nVoice commands enabled. Say "Hey Hataraku" to start.'));
    } catch (error) {
        console.error(chalk.red('\nFailed to initialize voice commands:'), error);
        process.exit(1);
    }

    return voiceMonitor;
}

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
            console.log(chalk.yellow(`Task history location: ${path.join(os.homedir(), '.config', 'hataraku', 'tasks')}\n`));
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

        // Initialize voice monitor if voice mode is enabled
        let voiceMonitor: VoiceMonitor | undefined;
        if (options.voice) {
            voiceMonitor = await initializeVoiceMonitor(taskLoop);
        }

        if (options.interactive) {
            // Interactive mode
            async function runInteractiveTask(currentTask?: string) {
                let taskToRun = currentTask;

                if (!taskToRun) {
                    taskToRun = await input({
                        message: 'Enter your task, or type "exit" to quit:',
                        default: task
                    });

                    if (taskToRun === 'exit') {
                        if (voiceMonitor) {
                            await voiceMonitor.stop();
                        }
                        console.log(chalk.yellow('Exiting interactive mode.'));
                        process.exit(0);
                    }
                }

                if (taskToRun) {
                    const followUpTasks = await taskLoop.run(taskToRun);
                    if (options.sound) {
                        await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
                    }

                    if (followUpTasks && followUpTasks.length > 0) {
                        const nextTask = await promptForNextTask(followUpTasks);
                        if (nextTask) {
                            await runInteractiveTask(nextTask);
                            return;
                        }
                    }

                    await runInteractiveTask();
                }
            }

            await runInteractiveTask(task);
        } else {
            // Normal mode
            if (!task && !options.voice) {
                console.error(chalk.red('Error: Please provide a task or question, or use --voice for voice commands'));
                program.help();
            }
            if (task) {
                await taskLoop.run(task);
                if (options.sound) {
                    await playAudioTool.execute({ path: 'audio/celebration.wav' }, process.cwd());
                }
            }
            // If only voice mode is enabled, keep the process running
            if (options.voice) {
                console.log(chalk.blue('\nListening for voice commands. Press Ctrl+C to exit.'));
                // Keep the process running
                await new Promise(() => { });
            }
        }

    } catch (error) {
        console.error(chalk.red('Error:'), error);
        console.error(chalk.yellow('\nDebug Information:'));
        console.error(chalk.yellow(`Provider: ${program.opts().provider}`));
        console.error(chalk.yellow(`Model: ${program.opts().model}`));
        process.exit(1);
    }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down...'));
    process.exit(0);
});

main().catch(console.error);