import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base';
import { createBedrockModel } from 'hataraku';

async function main() {
  // Create a model instance
  const model = createBedrockModel();

  // Create agent using our base configuration with explicit model
  const agent = await createBaseAgent({
    name: 'Streaming Task Agent',
    role: ROLES.POET,
    description: DESCRIPTIONS.POET,
    model // Explicitly provide the model
  });

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
