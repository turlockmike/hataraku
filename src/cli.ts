#!/usr/bin/env node

import { Command } from 'commander';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Agent } from './core/agent';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { version } from '../package.json';
import { startServer } from './server';
import { playAudioTool } from './lib/tools-deprecated/play-audio';
import { ALL_TOOLS } from './core/tools';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { createExecuteCommandTool } from './core/tools/execute-command';

interface CLIOptions {
    withAudio?: boolean;
    voice?: string;
}

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
  $ hataraku -i "initial task"                                             # Interactive mode with initial task
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

// Remove the executeCommandTool override
const executeCommandTool = createExecuteCommandTool({ outputColor: 'grey' });

async function processStreams(textStream: AsyncIterable<string>, options: any) {
    const consoleStream = new PassThrough();
    const sourceStream = new PassThrough();
    let fullText = '';  // Collect full text for TTS

    // Convert AsyncIterable to stream
    (async () => {
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
        }
    })();

    // Pipe source to console
    sourceStream.pipe(consoleStream);

    // Set up console output with color
    consoleStream.on('data', (chunk) => {
        // Color the agent's output in green
        process.stdout.write(chalk.green(chunk.toString()));
    });

    // Wait for console output to finish
    await new Promise<void>((resolve) => {
        consoleStream.on('end', resolve);
    });
}

// Add function to get environment info
function getEnvironmentInfo() {
    return `
<environment_details>
Environment Information:
Operating System: ${os.platform()} ${os.release()}
Architecture: ${os.arch()}
CPU Cores: ${os.cpus().length}
Total Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB
Free Memory: ${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB
Default Shell: ${process.env.SHELL || 'unknown'}
Home Directory: ${os.homedir()}
Current Working Directory: ${process.cwd()}
Node Version: ${process.version}
Current Time: ${new Date().toLocaleString()}
Locale: ${Intl.DateTimeFormat().resolvedOptions().locale}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
User Info: ${os.userInfo().username}
Package Manager: ${process.env.npm_config_user_agent?.split('/')[0] || 'npm'}
Terminal: ${process.env.TERM_PROGRAM || process.env.TERM || 'unknown'}
Git Branch: ${require('child_process').execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "not a git repo"').toString().trim()}
</environment_details>
`;
}

function getRules() {
    return `
    <rules>
    - You are a helpful AI assistant that can perform various tasks and answer questions.
    - When working with code, you should follow best practices and provide explanations.
    - You have access to various tools for working with files, executing commands, and more.
    - Use these tools when appropriate to help accomplish tasks.
    - You are STRICTLY FORBIDDEN from starting your messages with "Great", "Certainly", "Okay", "Sure". You should NOT be conversational in your responses, but rather direct and to the point. For example you should NOT say "Great, I've updated the CSS" but instead something like "I've updated the CSS". It is important you be clear and technical in your messages.
    - When presented with images, utilize your vision capabilities to thoroughly examine them and extract meaningful information. Incorporate these insights into your thought process as you accomplish the user's task.
    - At the end of each user message, you will automatically receive environment_details. This information is not written by the user themselves, but is auto-generated to provide potentially relevant context about the project structure and environment. While this information can be valuable for understanding the project context, do not treat it as a direct part of the user's request or response. Use it to inform your actions and decisions, but don't assume the user is explicitly asking about or referring to this information unless they clearly do so in their message. When using environment_details, explain your actions clearly to ensure the user understands, as they may not be aware of these details.
    - Your goal is to try to accomplish the user's task efficiently and effectively, NOT engage in a back and forth conversation. It is critical to wait for the user's response after each tool use to confirm its success before proceeding with additional actions.
    - You will be given a variety of tasks to complete. You should primarily consider your role and capabilities when deciding how to complete the task.
    - You accomplish a given task iteratively, breaking it down into clear steps and working through them methodically.
    - Analyze the user's task and set clear, achievable goals to accomplish it. Prioritize these goals in a logical order.
    - Remember, you have extensive capabilities with access to a wide range of tools that can be used in powerful and clever ways as necessary to accomplish each goal. Before calling a tool, do some analysis within <thinking></thinking> tags. First, analyze the file structure provided in environment_details to gain context and insights for proceeding effectively. Then, think about which of the provided tools is the most relevant tool to accomplish the user's task. Next, go through each of the required parameters of the relevant tool and determine if the user has directly provided or given enough information to infer a value. When deciding if the parameter can be inferred, carefully consider all the context to see if it supports a specific value. If all of the required parameters are present or can be reasonably inferred, close the thinking tag and proceed with the tool use. BUT, if one of the values for a required parameter is missing, DO NOT invoke the tool (not even with fillers for the missing params) and instead, ask the user to provide the missing parameters using the ask_followup_question tool. DO NOT ask for more information on optional parameters if it is not provided.
    - Once you've completed the user's task, you must attempt to complete the task.
    - The user may provide feedback, which you can use to make improvements and try again. But DO NOT continue in pointless back and forth conversations, i.e. don't end your responses with questions or offers for further assistance.
    </rules>
    `
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

        const environmentInfo = getEnvironmentInfo();

        // Initialize agent
        const agent = new Agent({
            name: 'Hataraku CLI Agent',
            description: 'A helpful AI assistant that can perform various tasks and answer questions',
            role: `You are a helpful AI assistant that can perform various tasks and answer questions.
                  You should be friendly but professional, and provide clear and concise responses.
                  When working with code, you should follow best practices and provide explanations.
                  You have access to various tools for working with files, executing commands, and more.
                  Use these tools when appropriate to help accomplish tasks.

                  ${environmentInfo}
                  ${getRules()}`,
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
                        await processStreams(result, options);
                    } else {
                        const result = await agent.task(taskToRun);
                        console.log(result);
                    }
                    // Finally play the celebratory audio
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
                    await processStreams(result, options);
                    
                } else {
                    const result = await agent.task(task);
                    console.log(result);
                    // Play the text if audio is enabled
                }
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

// Use the actual agent implementation
function createAgent(): Agent {
    const environmentInfo = getEnvironmentInfo();
    
    return new Agent({
        name: 'Hataraku CLI Agent',
        description: 'A helpful AI assistant that can perform various tasks and answer questions',
        role: `You are a helpful AI assistant that can perform various tasks and answer questions.
              You should be friendly but professional, and provide clear and concise responses.
              When working with code, you should follow best practices and provide explanations.
              You have access to various tools for working with files, executing commands, and more.
              Use these tools when appropriate to help accomplish tasks.

              ${environmentInfo}`,
        model: createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY || '',
        }).chat('anthropic/claude-3.5-sonnet'),
        tools: ALL_TOOLS,
        callSettings: {
            temperature: 0.7,
            maxTokens: 2000,
        }
    });
}

export async function runCLI(input: string, options: CLIOptions = {}): Promise<void> {
    const agent = createAgent();
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