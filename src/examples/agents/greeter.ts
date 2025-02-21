import { createTask } from '../../core/task';
import { createBaseAgent, ROLES, DESCRIPTIONS } from './base';

// Initialize the greeter agent
export const initializeGreeterAgent = async () => {
  return createBaseAgent({
    name: 'Greeter Agent',
    description: DESCRIPTIONS.GREETER,
    role: ROLES.GREETER
  });
};

// Create greeter tasks
export const createGreeterTasks = async () => {
  const greeterAgent = await initializeGreeterAgent();
  
  return {
    greet: createTask({
      name: 'Generate Greeting',
      description: 'Generates a friendly greeting for a given name',
      agent: greeterAgent,
      task: (input: { name: string }) => 
        `Generate a warm and friendly greeting for ${input.name}. Keep it simple and direct.`
    })
  };
}; 