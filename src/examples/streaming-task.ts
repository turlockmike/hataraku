import { Agent } from '../core/agent';
import { AgentConfig, TaskInput } from '../core/agent/types/config';
import { z } from 'zod';

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

  // Create task input with streaming enabled
  const task = {
    role: 'user' as const,
    content: 'Write a detailed epic poem (at least 20 lines) about a programmer\'s journey through learning artificial intelligence, with rich metaphors comparing coding concepts to natural phenomena. Include specific mentions of neural networks, machine learning algorithms, and the emotional journey of discovery.',
    stream: true as const // Enable streaming
  };

  try {
    // Execute task with streaming
    console.log('\nGenerating poem...\n');
    
    // Use for-await-of to process the stream
    const stream = await agent.task(task);
    for await (const chunk of stream) {
      // Print chunk without newline to show streaming effect
      process.stdout.write(chunk as string);
    }
    
    console.log('\n\nTask completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error);

// Example with schema validation:
async function schemaExample() {
  const agent = new Agent({
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'anthropic/claude-3-sonnet-20240229'
    },
    tools: []
  });
  await agent.initialize();

  // Define schema and type for structured output
  const StanzaSchema = z.object({
    stanza: z.number(),
    lines: z.array(z.string())
  });
  type Stanza = z.infer<typeof StanzaSchema>;

  const task = {
    role: 'user' as const,
    content: 'Write a poem with 3 stanzas, each with 4 lines. Return each stanza as a structured JSON object.',
    stream: true as const,
    outputSchema: StanzaSchema
  };

  try {
    // Process structured streaming output
    const stream = await agent.task<Stanza, true>(task);
    for await (const chunk of stream) {
      // Each chunk is a validated stanza object
      console.log(`\nStanza ${chunk.stanza}:`);
      for (const line of chunk.lines) {
        console.log(line);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}