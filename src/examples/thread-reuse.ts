import { Agent } from '../core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import chalk from 'chalk';
import { MemoryThreadStorage } from '../core/thread';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function main() {
  // Create agent config with OpenRouter/Sonnet model
  const config = {
    name: 'Thread Reuse Example',
    model: openrouter.chat('google/gemini-2.0-flash-lite-preview-02-05:free'),
    tools: {}, // No tools needed for this example
    role: 'You are a helpful assistant that can answer questions. Be friendly but concise.',
    description: 'You are a helpful assistant that can answer questions.'
  };

  // Create and initialize agent
  const agent = new Agent(config);

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