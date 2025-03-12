# Bedrock Caching Example

This example demonstrates the prompt caching feature with the AWS Bedrock provider in Hataraku.

## What it demonstrates

- How to enable/disable prompt caching in Hataraku agents
- How caching affects token usage for repeated prompts
- How to track token usage with and without caching

## How caching works

Hataraku implements prompt caching by adding cache control points to messages in the thread. For Bedrock, this is done by adding a `cachePoints: true` property to the provider options of messages.

When a prompt is repeated, the cached response is used instead of sending the full prompt to the model again, which reduces token usage and improves response time.

## Running the example

```bash
npx ts-node bedrock-caching.ts
```

## Key parts of the code

1. Creating an agent with caching enabled (default):
```typescript
const agent = createAgent({
  name: 'Bedrock Caching Agent',
  description: 'An agent that demonstrates caching with Bedrock',
  role: 'You are a helpful assistant that provides concise information about cloud computing concepts.',
  model,
  verbose: true
  // enableCaching: true is the default
});
```

2. Creating an agent with caching disabled:
```typescript
const agentNoCaching = createAgent({
  name: 'Bedrock No-Cache Agent',
  description: 'An agent that demonstrates disabled caching with Bedrock',
  role: 'You are a helpful assistant that provides concise information about cloud computing concepts.',
  model,
  enableCaching: false,
  verbose: true
});
```

3. Tracking token usage:
```typescript
const messages = thread.getMessages();
const lastMessage = messages[messages.length - 1];
const tokensIn = lastMessage.providerOptions?.usage?.tokensIn || 'unknown';
const tokensOut = lastMessage.providerOptions?.usage?.tokensOut || 'unknown';
```

## Expected output

The example will show:
1. First request with caching enabled - full token usage
2. Second request with the same prompt - reduced token usage due to caching
3. Third request with caching disabled - full token usage again

This demonstrates how caching can reduce token usage and potentially lower costs when using LLM APIs.