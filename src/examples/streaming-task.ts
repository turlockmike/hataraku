import { Agent } from '../core-old/agent';
import { AgentConfig } from '../core-old/agent/types/config';

async function main() {
  // Create agent config with OpenRouter/Sonnet model
  const config: AgentConfig = {
    name: 'Streaming Task Agent',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'anthropic/claude-3-sonnet-20240229'
    },
    tools: [] // No tools needed for this simple task
  };

  // Create and initialize agent
  const agent = new Agent(config);
  agent.initialize();

  // Create task input with streaming enabled
  const task = {
    role: 'user' as const,
    content: 'Write a detailed epic poem (at least 5 lines) about a programmer\'s journey through learning artificial intelligence, with rich metaphors comparing coding concepts to natural phenomena. Include specific mentions of neural networks, machine learning algorithms, and the emotional journey of discovery.',
    stream: true as const // Enable streaming
  };

  try {
    // Execute task with streaming
    console.log('\nGenerating poem...\n');
    
    // Use for-await-of to process the stream
    const result = await agent.task(task);
    let chunkCount = 0;
    for await (const chunk of result.stream) {
      chunkCount++;
      // Print chunk without newline to show streaming effect
      process.stdout.write(chunk);
    }
    
    console.log('\n\nTask completed!');
    console.log('Total chunks received:', chunkCount);
    console.log('metadata:', await result.metadata);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);
