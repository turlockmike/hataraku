import { createAgent } from '../../core/agent';
import { createTask } from '../../core/task';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Initialize OpenRouter
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Create a simple greeter agent
const greeterAgent = createAgent({
  name: 'Greeter Agent',
  description: 'A simple agent that generates greetings',
  role: 'You are a friendly greeter that generates warm and welcoming greetings.',
  model: openrouter.chat('anthropic/claude-3.5-sonnet')
});

// Tasks
export const greeterTasks = {
  greet: createTask({
    name: 'Generate Greeting',
    description: 'Generates a friendly greeting for a given name',
    agent: greeterAgent,
    task: (input: { name: string }) => 
      `Generate a warm and friendly greeting for ${input.name}. Keep it simple and direct.`
  })
}; 