import { Agent } from '../core/agent';
import { AgentConfig, TaskInput } from '../core/agent/types/config';

async function main() {
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

  // Create task input
  const task: TaskInput = {
    role: 'user',
    content: 'One word Response: What is the last name of the first president of the United States?'
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