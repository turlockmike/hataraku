import { Agent } from '../core-old/agent';
import { AgentConfig } from '../core-old/agent/types/config';
import { Thread } from '../core-old/thread/thread';

async function main() {
  // Create agent config with OpenRouter/Sonnet model
  const config: AgentConfig = {
    name: 'Thread Reuse Example',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'anthropic/claude-3.5-sonnet'
    },
    tools: [] // No tools needed for this example
  };

  // Create and initialize agent
  const agent = new Agent(config);

  // Create a thread that will be reused across tasks
  const thread = new Thread();

  // Add some context that will be available for all tasks
  thread.addContext('user_preferences', {
    language: 'English',
    format: 'concise',
    expertise_level: 'intermediate'
  });

  try {
    // First task - ask about a programming concept
    console.log('\nFirst Task - Asking a basic math question. What is 2 + 2?');
    const response1 = await agent.task({
      role: 'user',
      content: 'What is 2 + 2?',
      thread // Reuse the same thread
    });
    console.log('Response:', response1.content);

    // Second task - follow up question using context from first answer
    console.log('\nSecond Task - Following up on the explanation: Now add 5 to the result\n');
    const response2 = await agent.task({
      role: 'user',
      content: 'Now add 5 to the result',
      thread // Same thread maintains conversation context
    });
    console.log('Response:', response2.content);

    // Third task - another follow up
    console.log('\nThird Task - One more follow up: Now multiply the result by 3\n');
    const response3 = await agent.task({
      role: 'user',
      content: 'Now multiply the result by 3',
      thread
    });
    console.log('Response:', response3.content);

    // Show the conversation history
    console.log('\nFull Conversation History:');
    thread.getMessages().forEach((msg, i) => {
      console.log(`\n[${msg.role}]: ${msg.content}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error); 