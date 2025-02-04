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

  // Set up streaming event listener
  agent.on('streamChunk', (chunk) => {
    // Print chunk without newline to show streaming effect
    process.stdout.write(chunk);
  });

  // Create task input with streaming enabled
  const task: TaskInput = {
    role: 'user',
    content: 'Write a detailed epic poem (at least 20 lines) about a programmer\'s journey through learning artificial intelligence, with rich metaphors comparing coding concepts to natural phenomena. Include specific mentions of neural networks, machine learning algorithms, and the emotional journey of discovery.',
    stream: true // Enable streaming
  };

  try {
    // Execute task
    console.log('\nGenerating poem...\n');
    const response = await agent.task(task);
    console.log('\n\nTask completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);