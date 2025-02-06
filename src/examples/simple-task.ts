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
    name: 'Simple Task Agent',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'deepseek/deepseek-chat'
    },
    // No tools needed for this simple task
  };

  // Create and initialize agent
  const agent = new Agent(config);
  await agent.initialize();

  // Create task input
  const task = {
    role: 'user' as const,
    content: query
  };

  try {
    // Execute task and get complete response
    console.log('\nResponse:\n');
    const response = await agent.task(task);
    console.log(response);
    console.log(); // Add newline at end
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);