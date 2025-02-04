import { Agent } from '../core/agent';
import { AgentConfig, TaskInput } from '../core/agent/types/config';

async function main() {
  // Get query from command line arguments
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.error('Please provide a query. Usage: npm run example -- your query here');
    process.exit(1);
  }

  // Create agent config with OpenRouter/Sonnet model
  const config: AgentConfig = {
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'anthropic/claude-3-sonnet-20240229'
    },
    tools: [] // No tools needed for this simple task
  };

  // Create and initialize agent
  const agent = new Agent(config);
  await agent.initialize();

  // Create task input with query from command line
  const task: TaskInput = {
    role: 'user',
    content: query
  };

  try {
    // Execute task and log response
    const response = await agent.task(task);
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);