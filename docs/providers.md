# AI Provider Integrations

Hataraku supports multiple AI providers through a unified interface, allowing you to easily switch between different language models without changing your code structure.

## Supported Providers

Hataraku currently supports the following AI providers:

- **OpenRouter** - A unified API that routes to multiple AI models
- **Anthropic** - Direct integration with Anthropic's Claude models
- **Amazon Bedrock** - Access to AWS Bedrock's multi-model API
- **OpenAI** - Integration with OpenAI models
- **Google Vertex AI** - Access to Google's AI models like Gemini

## Provider Configuration

### OpenRouter

OpenRouter is the default provider in Hataraku and allows access to a wide range of models from different providers.

```typescript
import { Task } from 'hataraku';

// Create a task using an OpenRouter model
const task = new Task({
  description: 'Generate ideas for a new product',
  model: 'openrouter/anthropic/claude-3.7-sonnet' // Format: 'openrouter/{provider}/{model}'
});

// Execute the task
const result = await task.execute();
```

Configuration with API key:

```typescript
import { Task, createOpenRouterProvider } from 'hataraku';

// Create the provider
const provider = createOpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY
});

// Use the provider
const task = new Task({
  description: 'Generate ideas for a new product',
  model: provider.getModel('anthropic/claude-3.7-sonnet')
});
```

### Anthropic

Direct integration with Anthropic's Claude models:

```typescript
import { Task, createAnthropicProvider } from 'hataraku';

// Create the provider
const anthropicProvider = createAnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Use the provider
const task = new Task({
  description: 'Explain quantum computing',
  model: anthropicProvider.getModel('claude-3-sonnet')
});
```

Available models:
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`
- `claude-2.1`
- `claude-2.0`
- `claude-instant-1.2`

### Amazon Bedrock

Integration with AWS Bedrock for access to multiple foundational models:

```typescript
import { Task, createBedrockProvider } from 'hataraku';

// Create the provider
const bedrockProvider = createBedrockProvider({
  region: 'us-west-2', // Specify your AWS region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Use the provider with a Bedrock model
const task = new Task({
  description: 'Explain the solar system',
  model: bedrockProvider.getModel('anthropic.claude-3-sonnet-20240229-v1:0')
});
```

Available models depend on your AWS Bedrock configuration, but typically include:
- `anthropic.claude-3-opus-20240229-v1:0`
- `anthropic.claude-3-sonnet-20240229-v1:0`
- `anthropic.claude-3-haiku-20240307-v1:0`
- `anthropic.claude-2.1`
- `amazon.titan-text-express-v1`
- `meta.llama2-70b-chat-v1`

### OpenAI

Integration with OpenAI models:

```typescript
import { Task, createOpenAIProvider } from 'hataraku';

// Create the provider
const openaiProvider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY
});

// Use the provider
const task = new Task({
  description: 'Write a short story',
  model: openaiProvider.getModel('gpt-4')
});
```

Available models:
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

### Google Vertex AI

Integration with Google's Vertex AI models:

```typescript
import { Task, createVertexAIProvider } from 'hataraku';

// Create the provider
const vertexProvider = createVertexAIProvider({
  projectId: 'your-gcp-project-id',
  // Use Google Cloud authentication
});

// Use the provider
const task = new Task({
  description: 'Summarize this article',
  model: vertexProvider.getModel('gemini-1.5-pro')
});
```

Available models:
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-1.0-pro`

## Advanced Provider Configuration

### Call Settings

Each provider supports additional call settings to customize the model's behavior:

```typescript
import { Task } from 'hataraku';

const task = new Task({
  description: 'Generate creative ideas',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  callSettings: {
    maxTokens: 1000,      // Maximum tokens in the response
    temperature: 0.7,     // Control randomness (0-1)
    topP: 0.9,            // Nucleus sampling parameter
    topK: 40,             // Top-k sampling parameter
    presencePenalty: 0.5, // Penalty for token presence
    frequencyPenalty: 0.5 // Penalty for token frequency
  }
});
```

### Model Selection Best Practices

1. **Use OpenRouter for flexibility**: When you want to easily switch between models from different providers.

2. **Use Direct Providers for specific features**: When you need specific features only available with a direct provider integration.

3. **Consider cost and performance**: Different providers have different pricing models and performance characteristics:
   - Anthropic Claude models excel at longer context windows and complex reasoning
   - OpenAI GPT models are good general-purpose models with strong coding abilities
   - Amazon Bedrock offers enterprise-grade security and compliance features

4. **Environment-specific selection**: Use environment variables to configure different models for development and production:

```typescript
const getModelByEnvironment = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'openrouter/anthropic/claude-3.7-opus'; // Higher quality for production
  } else {
    return 'openrouter/anthropic/claude-3.7-sonnet'; // Lower cost for development
  }
};

const task = new Task({
  description: 'Generate code for a sorting algorithm',
  model: getModelByEnvironment()
});
```

## Error Handling

Each provider may have different error patterns. Hataraku normalizes these errors when possible:

```typescript
import { Task, ProviderError } from 'hataraku';

try {
  const task = new Task({
    description: 'Generate a complex analysis',
    model: 'openrouter/anthropic/claude-3.7-sonnet'
  });
  
  const result = await task.execute();
} catch (error) {
  if (error instanceof ProviderError) {
    console.error('Provider error:', error.message);
    
    // Handle specific error types
    if (error.code === 'rate_limit_exceeded') {
      console.log('Rate limit exceeded, retrying in 5 seconds...');
      // Implement retry logic...
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Creating a Custom Provider

You can create custom providers to integrate with other AI services:

```typescript
import { LanguageModelV1, ProviderV1 } from 'hataraku';

class CustomProvider implements ProviderV1 {
  constructor(private config: { apiKey: string }) {}
  
  getModel(modelId: string): LanguageModelV1 {
    return {
      id: modelId,
      provider: 'custom',
      execute: async (prompt, options) => {
        // Implement the execution logic using your custom API
        const response = await fetch('https://your-custom-api.com/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            prompt,
            max_tokens: options?.maxTokens,
            temperature: options?.temperature
          })
        });
        
        const data = await response.json();
        return data.text;
      }
    };
  }
}

// Usage
const customProvider = new CustomProvider({
  apiKey: process.env.CUSTOM_API_KEY
});

const task = new Task({
  description: 'Generate a custom response',
  model: customProvider.getModel('custom-model-id')
});
``` 