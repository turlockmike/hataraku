import { Command } from 'commander';
import chalk from 'chalk';
import { input, select, confirm } from '@inquirer/prompts';
import { ProfileManager } from '../../config/ProfileManager';
import { FirstRunManager } from '../../config/FirstRunManager';
import { Profile } from '../../config/profileConfig';

export function registerProfileCommands(program: Command): Command {
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
        console.log(`  ${chalk.gray('•')} Max Retries: ${profile.options?.maxRetries || 3}`);
        console.log(`  ${chalk.gray('•')} Max Steps: ${profile.options?.maxSteps || 50}`);
        console.log('');
      } catch (error) {
        console.error(chalk.red('Error showing profile:'), error);
        process.exit(1);
      }
    });

  profileCommand
    .command('use <name>')
    .description('Use a profile')
    .action(async (name: string) => {
      try {
        const profileManager = new ProfileManager();
        await profileManager.setActiveProfile(name);
        console.log(chalk.green(`Profile '${name}' set as active successfully.`));
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

  profileCommand
    .command('edit <n>')
    .description('Edit an existing profile')
    .action(async (name: string) => {
      try {
        const profileManager = new ProfileManager();
        
        // First, check if the profile exists
        let profile: Profile;
        try {
          profile = await profileManager.getProfile(name);
        } catch (error) {
          console.error(chalk.red(`Profile '${name}' not found.`));
          process.exit(1);
          return;
        }

        console.log(chalk.bold(`\nEditing Profile: ${profile.name}`));
        console.log(chalk.gray('─'.repeat(30)));
        
        // Ask for description
        const description = await input({
          message: 'Profile description:',
          default: profile.description || 'Default Hataraku profile'
        });
        
        // Choose provider
        const provider = await select({
          message: 'Select provider:',
          choices: [
            { name: 'OpenRouter (Anthropic, OpenAI, etc.)', value: 'openrouter' },
            { name: 'Anthropic', value: 'anthropic' },
            { name: 'AWS Bedrock', value: 'bedrock' }
          ],
          default: profile.provider
        });
        
        // Choose model based on provider
        let modelChoices;
        switch (provider) {
          case 'openrouter':
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'anthropic/claude-3.7-sonnet' },
              { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
              { name: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
              { name: 'Gemini Flash 1.5', value: 'google/gemini-flash-1.5' },
              { name: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
              { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' }
            ];
            break;
          case 'anthropic':
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
              { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' }
            ];
            break;
          case 'bedrock':
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'us.anthropic.claude-3-7-sonnet-20250219-v1.0' },
              { name: 'Claude 3.5 Sonnet', value: 'us.anthropic.claude-3-5-sonnet-20241022-v2.0' }
            ];
            break;
          default:
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' }
            ];
        }
        
        const model = await select({
          message: 'Select model:',
          choices: modelChoices,
          default: profile.model
        });
        
        // Provider-specific options
        let providerOptions = profile.providerOptions || {};
        
        if (provider === 'bedrock') {
          const awsProfile = await input({
            message: 'AWS profile to use:',
            default: providerOptions.profile || 'default'
          });
          providerOptions = { ...providerOptions, profile: awsProfile };
        }
        
        // Configure options
        const stream = await confirm({
          message: 'Enable streaming responses?',
          default: profile.options?.stream ?? true
        });
        
        const sound = await confirm({
          message: 'Enable sound effects?',
          default: profile.options?.sound ?? true
        });
        
        // Create updated profile
        const updatedProfile: Partial<Profile> = {
          description,
          provider: provider as string,
          model: model as string,
          providerOptions,
          options: {
            ...(profile.options || {}),
            stream,
            sound
          }
        };
        
        // Save profile updates
        await profileManager.updateProfile(name, updatedProfile);
        console.log(chalk.green(`Profile '${name}' updated successfully.`));
      } catch (error) {
        console.error(chalk.red('Error editing profile:'), error);
        process.exit(1);
      }
    });

  return program;
} 