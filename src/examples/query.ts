import { Agent } from '../core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function main() {
  // Get query from command line arguments
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.error('Please provide a query. Usage: npm run example -- your query here');
    process.exit(1);
  }

  // Create and initialize agent
  const agent = new Agent(
    {
      name: 'Simple Task Agent',
      description: 'A simple agent that can answer questions',
      role: 'You are a helpful assistant that can answer questions',
      model: openrouter.chat('anthropic/claude-3.5-sonnet')
    }
  );

  try {
    // Execute task and get complete response
    console.log('\nResponse:\n');
    const response = await agent.task(query);
    console.log(await response);
    console.log(); // Add newline at end
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);