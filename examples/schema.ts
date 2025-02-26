import assert from 'node:assert';
import { z } from 'zod';
import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base';

async function main() {
  // Initialize the agent with basic configuration
  const agent = createBaseAgent({
    name: 'schema-validation-example',
    role: 'You are a helpful assistant that provides structured data.',
    description: 'You are a helpful assistant that provides structured data.'
  });

  const simpleSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    age: z.number(),
    email: z.string().email(),
    phone: z.string().optional(),
  });

  const result = await agent.task('Generate a mock user profile', {
    schema: simpleSchema,
  });
  assert(typeof result.age === 'number');
  assert(typeof result.email === 'string');
  assert(typeof result.firstName === 'string');
  assert(typeof result.lastName === 'string');
  assert(result.phone === undefined || typeof result.phone === 'string');

  // Generate a pretty print of the result
  console.log(JSON.stringify(result, null, 2));
}

// Run the examples
main().catch(console.error); 