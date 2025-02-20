import { Agent } from '../core/agent';
import chalk from 'chalk';
import { MemoryThreadStorage } from '../core/thread';
import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base';

async function main() {
  // Create agent using our base configuration
  const agent = createBaseAgent({
    name: 'Thread Reuse Example',
    role: 'You are a helpful assistant that can answer questions. Be friendly but concise.',
    description: 'You are a helpful assistant that can answer questions.'
  });

  const threadStorage = new MemoryThreadStorage();
  const thread = threadStorage.create();

  thread.addMessage('user', "I'm really bad at math, can you help me with this?");
  // Add some context that will be available for all tasks
  thread.addMessage('user', 'Please response in japanese and english to all prompts');

  try {
    // First task - ask about a programming concept
    console.log(chalk.blue('What is 2 + 2?'));
    const response1 = await agent.task('What is 2 + 2?', {
      thread,
    });
    console.log(chalk.green(response1));

    // Second task - follow up question using context from first answer
    console.log(chalk.blue('Now add 5 to the result'));
    const response2 = await agent.task('Now add 5 to the result', {
      thread,
    });
    console.log(chalk.green(response2));

    // Third task - another follow up
    console.log(chalk.blue('Now multiply the result by 3'));
    const response3 = await agent.task('Now multiply the result by 3', {
      thread,
    });
  
    console.log(chalk.green(response3));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error); 