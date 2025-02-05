import { Agent } from '../core/agent';
import { z } from 'zod';

async function main() {
  // Initialize the agent with basic configuration
  const agent = new Agent({
    name: 'schema-validation-example',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'anthropic/claude-3-sonnet-20240229'
    },
    tools: [], // No tools needed for this example
    role: 'You are a helpful assistant that provides structured data.',
  });

  // Initialize the agent
  await agent.initialize();

  const simpleSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    age: z.number(),
    email: z.string().email(),
    phone: z.string().optional(),
  });

  const simpleResult = await agent.task({
    role: 'user',
    content: 'Generate a mock user profile',
    outputSchema: simpleSchema,
  });

  // Generate a pretty print of the result
  console.log(JSON.stringify(simpleResult, null, 2));

}

// Run the examples
main().catch(console.error); 