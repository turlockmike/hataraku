import { Agent, AgentConfig } from '../core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function main() {
  // Create agent config with OpenRouter/Sonnet model
  const config = {
    name: 'Streaming Task Agent',
    model: openrouter.chat('google/gemini-2.0-flash-lite-preview-02-05:free'),
    tools: {}, // No tools needed for this simple task
    role: 'You are a helpful assistant that can write poems.',
    description: 'You are a helpful assistant that can write poems.'
  };

  // Create and initialize agent
  const agent = new Agent(config);

  try {
    // Execute task with streaming
    console.log('\nGenerating poem...\n');
    
    // Use for-await-of to process the stream
    const result = await agent.task('Write a detailed epic poem (at least 5 lines) about a programmer\'s journey through learning artificial intelligence, with rich metaphors comparing coding concepts to natural phenomena. Include specific mentions of neural networks, machine learning algorithms, and the emotional journey of discovery.', {stream: true});
    for await (const chunk of result) {
      // Print chunk without newline to show streaming effect
      process.stdout.write(chunk);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);
