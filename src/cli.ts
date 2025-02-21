#!/usr/bin/env node

import { Command } from 'commander';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { version } from '../package.json';
import { PassThrough } from 'node:stream';
import { createCLIAgent } from './core/agents';
import { createBedrockProvider } from './core/providers/bedrock';
import { playAudioTool } from './core/tools/play-audio';

const program = new Command();

// Add default command
program
    .name('hataraku')
    .description('Hataraku is a CLI tool for creating and managing tasks')
    .option('--update', 'Update Hataraku to the latest version')
    .option('-p, --provider <provider>', 'API provider to use (openrouter, bedrock)')
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet). Check with the provider for available models.')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
    .option('--no-sound', 'Disable sound effects')
    .option('--no-stream', 'Disable streaming responses')
    .option('--region <region>', 'AWS region for Bedrock (defaults to AWS_REGION env var)')
    .arguments('[task...]')
    .version(version)
    .addHelpText('after', `
Examples:
  $ hataraku "create a hello world html file"                                # Uses default model (claude-3.5-sonnet)
  $ hataraku --model deepseek/deepseek-chat "explain this code"             # Uses different model
  $ hataraku --provider anthropic --model claude-3 "write a test"           # Uses different provider
  $ hataraku --provider bedrock --model anthropic.claude-3-sonnet-20240229-v1:0 "analyze this code"  # Uses AWS Bedrock
  $ OPENROUTER_API_KEY=<key> hataraku "write a test file"                  # Provides API key via env var
  $ hataraku -i                                                             # Run in interactive mode
  $ hataraku -i "initial task"                                             # Interactive mode with initial task
  $ hataraku --no-sound "create a test file"                               # Run without sound effects
  $ hataraku --no-stream "explain this code"                               # Run without streaming responses
  $ hataraku serve                                                          # Start web interface

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI
  AWS_ACCESS_KEY_ID     - AWS access key ID for Bedrock
  AWS_SECRET_ACCESS_KEY - AWS secret access key for Bedrock
  AWS_REGION           - AWS region for Bedrock (defaults to us-east-1)`)
    .action(async (task) => {
        // The task will be handled by main() after parsing
    });

async function processStreams(textStream: AsyncIterable<string>, options: any) {
    const consoleStream = new PassThrough();
    const sourceStream = new PassThrough();
    let fullText = '';  // Collect full text for TTS

    // Convert AsyncIterable to stream
    const streamPromise = (async () => {
        try {
            for await (const chunk of textStream) {
                sourceStream.write(chunk);
                if (options.withAudio) {
                    fullText += chunk;  // Collect text for TTS
                }
            }
            sourceStream.end();
        } catch (err) {
            sourceStream.destroy(err as Error);
            throw err; // Re-throw to be caught by the outer try-catch
        }
    })();

    // Pipe source to console
    sourceStream.pipe(consoleStream);

    // Set up console output with color
    consoleStream.on('data', (chunk) => {
        // Color the agent's output in green
        process.stdout.write(chalk.green(chunk.toString()));
    });

    // Wait for both the stream processing and console output to finish
    await Promise.all([
        streamPromise,
        new Promise<void>((resolve, reject) => {
            consoleStream.on('end', resolve);
            consoleStream.on('error', reject);
        })
    ]);

    // Add a newline at the end for better formatting
    process.stdout.write('\n');
}

async function main(task?: string) {
    try {
        const options = program.opts();
        let model;
        if (options.provider === 'bedrock') {
            // Use AWS Bedrock
            const bedrock = await createBedrockProvider();
            model = bedrock(options.model || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0');
        } else {
            // Check for API key for other providers
            const apiKey = options.apiKey || process.env[`${options.provider.toUpperCase()}_API_KEY`];
            if (!apiKey) {
                console.error(chalk.red(`Error: API key required. Provide via --api-key or ${options.provider.toUpperCase()}_API_KEY env var`));
                return 1;
            }

            // Initialize OpenRouter client
            const openrouter = createOpenRouter({
                apiKey,
            });
            model = openrouter.chat(options.model || 'anthropic/claude-3.5-sonnet');
        }

        // Initialize agent using our factory function
        const agent = createCLIAgent(model);

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
                        await processStreams(result, options);
                    } else {
                        const result = await agent.task(taskToRun);
                        console.log(result);
                    }
                    
                    // Add a small delay to ensure task history is saved
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Finally play the celebratory audio
                    if (options.sound) {
                        await playAudioTool.execute({ path: 'audio/celebration.wav' }, {toolCallId: 'celebration', messages: []});
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
                    await processStreams(result, options);
                } else {
                    const result = await agent.task(task);
                    console.log(result);
                }
                
                // Add a small delay to ensure task history is saved
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (options.sound) {
                    await playAudioTool.execute({ path: 'audio/celebration.wav' }, {toolCallId: 'celebration', messages: []});
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

// Export runCLI function for programmatic use
export async function runCLI(input: string): Promise<void> {
    const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY || '',
    });

    const agent = createCLIAgent(openrouter.chat('anthropic/claude-3.5-sonnet'));
    const sourceStream = new PassThrough();
    const consoleStream = new PassThrough();

    // Set up console output
    const consoleOutput = new Promise<void>((resolve, reject) => {
        consoleStream.on('data', chunk => process.stdout.write(chunk.toString()));
        consoleStream.on('end', resolve);
        consoleStream.on('error', reject);
    });

    // Process agent response
    try {
        const agentResponse = await agent.task(input, { stream: false });
        
        // Write response to streams
        sourceStream.write(agentResponse);
        sourceStream.end();

        // Pipe source to console
        sourceStream.pipe(consoleStream);

        // Wait for console output to finish
        await consoleOutput;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        // Clean up streams
        sourceStream.destroy();
        consoleStream.destroy();
    }
} 