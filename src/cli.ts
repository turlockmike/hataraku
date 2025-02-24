#!/usr/bin/env node

import { Command } from 'commander';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { version } from '../package.json';
import { PassThrough } from 'node:stream';
import { createCLIAgent } from './core/agents';
import { createBedrockProvider } from './core/providers/bedrock';
import { playAudioTool } from './core/tools/play-audio';
import { FirstRunManager } from './config/FirstRunManager';
import { ConfigLoader, CliOptions } from './config/ConfigLoader';
import { AgentConfig } from './config/agentConfig';
import { ProfileManager } from './config/ProfileManager';
import { TaskManager } from './config/TaskManager';
import { Profile } from './config/profileConfig';
import { AgentManager } from './config/AgentManager';

const program = new Command();

// Add configuration commands
const profileCommand = program
  .command('profile')
  .description('Manage profiles');

profileCommand
  .command('list')
  .description('List all profiles')
  .action(async () => {
    try {
      const profileManager = new ProfileManager();
      const profiles = await profileManager.listProfiles();
      const activeProfile = (await profileManager.getActiveProfile()).name;
      
      console.log(chalk.bold('\nAvailable Profiles:'));
      for (const profile of profiles) {
        if (profile === activeProfile) {
          console.log(`  ${chalk.green('●')} ${chalk.bold(profile)} ${chalk.gray('(active)')}`);
        } else {
          console.log(`  ${chalk.gray('○')} ${profile}`);
        }
      }
      console.log('');
    } catch (error) {
      console.error(chalk.red('Error listing profiles:'), error);
      process.exit(1);
    }
  });

profileCommand
  .command('show [name]')
  .description('Show profile details')
  .action(async (name?: string) => {
    try {
      const profileManager = new ProfileManager();
      const profileName = name || (await profileManager.getActiveProfile()).name;
      const profile = await profileManager.getProfile(profileName);
      
      console.log(chalk.bold(`\nProfile: ${profile.name}`));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.blue('Description:')}  ${profile.description || 'No description'}`);
      console.log(`${chalk.blue('Provider:')}     ${profile.provider || 'Not set'}`);
      console.log(`${chalk.blue('Model:')}        ${profile.model || 'Not set'}`);
      console.log(`${chalk.blue('Agent:')}        ${profile.agent || 'Not set'}`);
      console.log(`${chalk.blue('Tools:')}        ${profile.tools?.join(', ') || 'None'}`);
      
      console.log(chalk.blue('\nOptions:'));
      console.log(`  ${chalk.gray('•')} Streaming:   ${profile.options?.stream ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      console.log(`  ${chalk.gray('•')} Sound:       ${profile.options?.sound ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      console.log(`  ${chalk.gray('•')} Interactive: ${profile.options?.interactive ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      console.log('');
    } catch (error) {
      console.error(chalk.red('Error showing profile:'), error);
      process.exit(1);
    }
  });

profileCommand
  .command('activate <name>')
  .description('Activate a profile')
  .action(async (name: string) => {
    try {
      const profileManager = new ProfileManager();
      await profileManager.setActiveProfile(name);
      console.log(chalk.green(`Profile '${name}' activated successfully.`));
    } catch (error) {
      console.error(chalk.red('Error activating profile:'), error);
      process.exit(1);
    }
  });

profileCommand
  .command('create')
  .description('Create a new profile')
  .action(async () => {
    try {
      const firstRunManager = new FirstRunManager();
      await firstRunManager.createDefaultProfileWithWizard();
      console.log(chalk.green('Profile created successfully.'));
    } catch (error) {
      console.error(chalk.red('Error creating profile:'), error);
      process.exit(1);
    }
  });

// Add task management commands
const taskCommand = program
  .command('task')
  .description('Manage tasks');

taskCommand
  .command('list')
  .description('List all tasks')
  .action(async () => {
    try {
      const taskManager = new TaskManager();
      const tasks = await taskManager.listTasks();
      
      console.log(chalk.bold('\nAvailable Tasks:'));
      if (tasks.length === 0) {
        console.log(chalk.gray('  No tasks found.'));
      } else {
        for (const task of tasks) {
          console.log(`  ${chalk.blue('•')} ${task}`);
        }
      }
      console.log('');
    } catch (error) {
      console.error(chalk.red('Error listing tasks:'), error);
      process.exit(1);
    }
  });

taskCommand
  .command('show <name>')
  .description('Show task details')
  .action(async (name: string) => {
    try {
      const taskManager = new TaskManager();
      const task = await taskManager.getTask(name);
      
      console.log(chalk.bold(`\nTask: ${task.name}`));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.blue('Description:')}  ${task.description}`);
      console.log(`${chalk.blue('Agent:')}        ${task.agent}`);
      
      if (task.schema) {
        console.log(chalk.blue('\nInput Schema:'));
        console.log(`  ${JSON.stringify(task.schema, null, 2).replace(/\n/g, '\n  ')}`);
      }
      
      console.log(chalk.blue('\nTask Definition:'));
      if (typeof task.task === 'string') {
        console.log(`  ${task.task.substring(0, 100)}${task.task.length > 100 ? '...' : ''}`);
      } else {
        console.log(`  Template with parameters: ${task.task.parameters.join(', ')}`);
      }
      console.log('');
    } catch (error) {
      console.error(chalk.red('Error showing task:'), error);
      process.exit(1);
    }
  });

taskCommand
  .command('run <name>')
  .description('Run a task')
  .option('--agent <agent>', 'Use a specific agent for this task')
  .option('--provider <provider>', 'Use a specific provider for this task')
  .option('--model <model>', 'Use a specific model for this task')
  .action(async (name: string, options: any) => {
    try {
      const taskManager = new TaskManager();
      const task = await taskManager.getTask(name);
      
      console.log(chalk.blue(`\nPreparing to run task: ${task.name}`));
      
      // Get input for task
      const inputData: Record<string, any> = {};
      if (task.schema) {
        const schema = task.schema as any;
        if (schema.properties) {
          for (const [key, prop] of Object.entries<any>(schema.properties)) {
            const isRequired = schema.required && schema.required.includes(key);
            const promptMessage = `${prop.description || key}${isRequired ? ' (required)' : ''}:`;
            
            if (prop.type === 'array') {
              const items = await input({
                message: promptMessage,
                validate: value => {
                  if (isRequired && !value) return 'This field is required';
                  return true;
                }
              });
              
              inputData[key] = items.split(',').map(item => item.trim());
            } else if (prop.type === 'boolean') {
              inputData[key] = await select({
                message: promptMessage,
                choices: [
                  { name: 'Yes', value: true },
                  { name: 'No', value: false }
                ]
              });
            } else {
              inputData[key] = await input({
                message: promptMessage,
                validate: value => {
                  if (isRequired && !value) return 'This field is required';
                  return true;
                }
              });
            }
          }
        }
      }
      
      // Process task template
      const prompt = taskManager.processTaskTemplate(task, inputData);
      
      console.log(chalk.blue('\nExecuting task...'));
      
      // Get agent (from option, task config, or default)
      const configLoader = new ConfigLoader();
      const profile = await (new ProfileManager()).getActiveProfile();
      let agent: AgentConfig | undefined;
      
      if (options.agent) {
        try {
          agent = await (new AgentManager()).getAgent(options.agent);
        } catch (error) {
          console.error(chalk.yellow(`Warning: Agent '${options.agent}' not found. Using task agent.`));
        }
      }
      
      if (!agent) {
        try {
          agent = await (new AgentManager()).getAgent(task.agent);
        } catch (error) {
          console.error(chalk.yellow(`Warning: Task agent '${task.agent}' not found. Using default configuration.`));
        }
      }
      
      // Execute task with agent or directly with model
      const cliOptions: CliOptions = {
        provider: options.provider || profile.provider,
        model: options.model || profile.model,
        agent: agent?.name,
        stream: profile.options?.stream,
        sound: profile.options?.sound
      };
      
      const result = await executeWithConfig(prompt, cliOptions);
      process.exit(result);
    } catch (error) {
      console.error(chalk.red('Error running task:'), error);
      process.exit(1);
    }
  });

// Add configuration command
program
  .command('config')
  .description('Manage configuration')
  .action(async () => {
    const configLoader = new ConfigLoader();
    
    try {
      const config = await configLoader.loadConfig();
      console.log(chalk.bold('\nConfiguration Summary:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.blue('Active Profile:')}  ${config.activeProfile}`);
      console.log(`${chalk.blue('Profiles:')}        ${config.profiles.length}`);
      console.log(`${chalk.blue('Agents:')}          ${config.agents.length}`);
      console.log(`${chalk.blue('Tasks:')}           ${config.tasks.length}`);
      console.log(`${chalk.blue('Tools:')}           ${config.tools.length}`);
      console.log('');
    } catch (error) {
      console.error(chalk.red('Error loading configuration:'), error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize configuration')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (options: any) => {
    try {
      const firstRunManager = new FirstRunManager();
      
      if (options.yes) {
        await firstRunManager.initializeDefaults();
      } else {
        await firstRunManager.runSetupWizard();
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error initializing configuration:'), error);
      process.exit(1);
    }
  });

// Add default command
program
    .name('hataraku')
    .description('Hataraku is a CLI tool for creating and managing tasks')
    .option('--update', 'Update Hataraku to the latest version')
    .option('-p, --provider <provider>', 'API provider to use (openrouter, bedrock)')
    .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet)')
    .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
    .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
    .option('--no-sound', 'Disable sound effects')
    .option('--no-stream', 'Disable streaming responses')
    .option('--region <region>', 'AWS region for Bedrock (defaults to AWS_REGION env var)')
    .option('--profile <profile>', 'Use specific profile')
    .option('--agent <agent>', 'Use specific agent')
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
  $ hataraku --profile coding "refactor this code"                         # Use a specific profile
  $ hataraku --agent code-reviewer "review my code"                        # Use a specific agent
  $ hataraku profile list                                                  # List all profiles
  $ hataraku task run code-review                                          # Run a saved task
  $ hataraku init                                                          # Initialize configuration

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI
  AWS_ACCESS_KEY_ID     - AWS access key ID for Bedrock
  AWS_SECRET_ACCESS_KEY - AWS secret access key for Bedrock
  AWS_REGION           - AWS region for Bedrock (defaults to us-east-1)`)
    .action(async (task) => {
        // Check if this is the first run
        const firstRunManager = new FirstRunManager();
        const isFirstRun = await firstRunManager.isFirstRun();
        
        if (isFirstRun) {
          console.log(chalk.yellow('\nFirst run detected. Initializing default configuration...'));
          await firstRunManager.initializeDefaults();
        }
        
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

async function executeWithConfig(task: string, cliOptions: CliOptions) {
    try {
        const configLoader = new ConfigLoader();
        const { profile, agent } = await configLoader.getEffectiveConfig(cliOptions);
        
        // Determine which model to use
        let model;
        const provider = cliOptions.provider || profile.provider;
        const modelName = cliOptions.model || profile.model;
        
        if (!provider) {
            console.error(chalk.red('Error: No provider specified in profile or command line.'));
            return 1;
        }
        
        if (!modelName) {
            console.error(chalk.red('Error: No model specified in profile or command line.'));
            return 1;
        }
        
        if (provider === 'bedrock') {
            // Use AWS Bedrock
            const region = cliOptions.region || process.env.AWS_REGION || 'us-east-1';
            const bedrock = await createBedrockProvider(region);
            model = bedrock(modelName);
        } else {
            // Check for API key for other providers
            const apiKey = cliOptions.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
            if (!apiKey) {
                console.error(chalk.red(`Error: API key required. Provide via --api-key or ${provider.toUpperCase()}_API_KEY env var`));
                return 1;
            }

            // Initialize OpenRouter client
            const openrouter = createOpenRouter({
                apiKey,
            });
            model = openrouter.chat(modelName);
        }

        // Initialize agent using our factory function
        const cliAgent = createCLIAgent(model);
        const isInteractive = cliOptions.interactive !== undefined ? cliOptions.interactive : profile.options?.interactive;
        const shouldStream = cliOptions.stream !== undefined ? cliOptions.stream : profile.options?.stream;
        const shouldPlaySound = cliOptions.sound !== undefined ? cliOptions.sound : profile.options?.sound;
        
        // Options object for functions
        const options = {
            sound: shouldPlaySound,
            stream: shouldStream
        };

        if (isInteractive) {
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
                    if (shouldStream) {
                        const result = await cliAgent.task(taskToRun, { stream: true });
                        await processStreams(result, options);
                    } else {
                        const result = await cliAgent.task(taskToRun);
                        console.log(chalk.green(result));
                    }
                    
                    // Add a small delay to ensure task history is saved
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Finally play the celebratory audio
                    if (shouldPlaySound) {
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
                if (shouldStream) {
                    const result = await cliAgent.task(task, { stream: true });
                    await processStreams(result, options);
                } else {
                    const result = await cliAgent.task(task);
                    console.log(chalk.green(result));
                }
                
                // Add a small delay to ensure task history is saved
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (shouldPlaySound) {
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

// Main function to handle command line invocation
async function main(task?: string) {
    const options = program.opts();
    const cliOptions: CliOptions = {
        profile: options.profile,
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey,
        interactive: options.interactive,
        stream: options.stream,
        sound: options.sound,
        agent: options.agent,
        region: options.region
    };
    
    return executeWithConfig(task, cliOptions);
}

// Only run the program if this file is being run directly
if (require.main === module) {
    // Parse command line arguments
    program.parse();
    
    // If no arguments or a subcommand, don't run main
    if (program.args.length === 0 || program.commands.some(cmd => cmd.name() === program.args[0])) {
        // No need to call main() if running a subcommand
    } else {
        const task = program.args[0];
        main(task).then((code) => {
            process.exit(code);
        }).catch((error) => {
            console.error(chalk.red('Fatal error:'), error);
            process.exit(1);
        });
    }
}

// Export for testing
export { program, main };

// Export runCLI function for programmatic use
export async function runCLI(input: string): Promise<void> {
    try {
        const configLoader = new ConfigLoader();
        const profile = await (new ProfileManager()).getActiveProfile();
        
        const cliOptions: CliOptions = {
            provider: profile.provider,
            model: profile.model,
            stream: false,
            sound: false
        };
        
        await executeWithConfig(input, cliOptions);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}