import chalk from 'chalk';
import { createAgent, Thread, createBedrockModel } from 'hataraku';

/**
 * This example demonstrates the caching feature with the Bedrock provider.
 * It shows both tokens used for initial requests and cached tokens for repeated requests.
 * 
 * Key points:
 * - Caching is enabled by default in the agent configuration
 * - The first request will use full tokens
 * - The second request with the same prompt will use cached results
 * - The third request with caching disabled will use full tokens again
 * 
 * The example tracks and displays token usage for each request to demonstrate the caching effect.
 */
async function main() {
  console.log(chalk.cyan('\n🚀 Bedrock Caching Example\n'));

  try {
    // Create a Bedrock model
    console.log(chalk.cyan('⚙️ Creating Bedrock model...'));
    const model = await createBedrockModel();
    
    // Create an agent with caching enabled (default)
    console.log(chalk.cyan('🤖 Creating agent with caching enabled...'));
    const agent = createAgent({
      name: 'Bedrock Caching Agent',
      description: 'An agent that demonstrates caching with Bedrock',
      role: 'You are a helpful assistant that provides concise information about cloud computing concepts.',
      model,
      verbose: true
    });

    // First request - should use tokens and add cache control points
    console.log(chalk.cyan('\n📝 First request - should use tokens:'));
    const thread = new Thread();
    const response1 = await agent.task('Explain what serverless computing is in 2-3 sentences.', { thread });
    
    console.log(chalk.green('\n✅ First response:'));
    console.log(chalk.gray(response1));
    
    // Display token usage from the first request
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];
    const tokensIn = lastMessage.providerOptions?.usage?.tokensIn || 'unknown';
    const tokensOut = lastMessage.providerOptions?.usage?.tokensOut || 'unknown';
    
    console.log(chalk.yellow('\n📊 Token usage (first request):'));
    console.log(chalk.gray(`   Input tokens: ${tokensIn}`));
    console.log(chalk.gray(`   Output tokens: ${tokensOut}`));
    
    // Second request with the same prompt - should use cache
    console.log(chalk.cyan('\n📝 Second request with same prompt - should use cache:'));
    const response2 = await agent.task('Explain what serverless computing is in 2-3 sentences.', { thread });
    
    console.log(chalk.green('\n✅ Second response:'));
    console.log(chalk.gray(response2));
    
    // Display token usage from the second request
    const messages2 =  thread.getMessages();
    const lastMessage2 = messages2[messages2.length - 1];
    const tokensIn2 = lastMessage2.providerOptions?.usage?.tokensIn || 'unknown';
    const tokensOut2 = lastMessage2.providerOptions?.usage?.tokensOut || 'unknown';
    
    console.log(chalk.yellow('\n📊 Token usage (second request):'));
    console.log(chalk.gray(`   Input tokens: ${tokensIn2}`));
    console.log(chalk.gray(`   Output tokens: ${tokensOut2}`));
    
    // Third request with caching disabled
    console.log(chalk.cyan('\n📝 Third request with caching disabled:'));
    const agentNoCaching = createAgent({
      name: 'Bedrock No-Cache Agent',
      description: 'An agent that demonstrates disabled caching with Bedrock',
      role: 'You are a helpful assistant that provides concise information about cloud computing concepts.',
      model,
      enableCaching: false,
      verbose: true
    });
    
    const thread3 = new Thread();
    const response3 = await agentNoCaching.task('Explain what serverless computing is in 2-3 sentences.', { thread: thread3 });
    
    console.log(chalk.green('\n✅ Third response (no caching):'));
    console.log(chalk.gray(response3));
    
    // Display token usage from the third request
    const messages3 = thread3.getMessages();
    const lastMessage3 = messages3[messages3.length - 1];
    const tokensIn3 = lastMessage3.providerOptions?.usage?.tokensIn || 'unknown';
    const tokensOut3 = lastMessage3.providerOptions?.usage?.tokensOut || 'unknown';
    
    console.log(chalk.yellow('\n📊 Token usage (third request, no caching):'));
    console.log(chalk.gray(`   Input tokens: ${tokensIn3}`));
    console.log(chalk.gray(`   Output tokens: ${tokensOut3}`));
    
    // Summary
    console.log(chalk.cyan('\n📋 Summary:'));
    console.log(chalk.gray(`   First request (with caching): ${tokensIn} input tokens, ${tokensOut} output tokens`));
    console.log(chalk.gray(`   Second request (cached): ${tokensIn2} input tokens, ${tokensOut2} output tokens`));
    console.log(chalk.gray(`   Third request (no caching): ${tokensIn3} input tokens, ${tokensOut3} output tokens`));
    
    if (tokensIn2 < tokensIn || tokensOut2 < tokensOut) {
      console.log(chalk.green('\n✅ Caching is working! The second request used fewer tokens.'));
    } else {
      console.log(chalk.yellow('\n⚠️ Caching might not be working as expected. The second request did not use fewer tokens.'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
main();