# AWS Bedrock Knowledge Base Provider

Hataraku provides integration with AWS Bedrock Knowledge Base, allowing you to query your knowledge bases using natural
language. This feature enables Retrieval-Augmented Generation (RAG) applications by leveraging your own data sources.

## Prerequisites

Before using the knowledge base provider, you need:

1. An AWS account with access to Amazon Bedrock
2. A knowledge base created in Amazon Bedrock
3. AWS credentials configured (via AWS CLI, environment variables, or AWS profiles)
4. The knowledge base ID of your AWS Bedrock knowledge base

## Installation

The knowledge base provider is included in the Hataraku package:

```bash
npm install hataraku
```

## Usage

### SDK Usage

```typescript
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime'
import { fromIni } from '@aws-sdk/credential-providers'
import { createKnowledgeBaseProvider } from 'hataraku'

// Create the AWS Bedrock client
const client = new BedrockAgentRuntimeClient({
  region: 'us-east-1',
  credentials: await fromIni({ profile: 'default' })(),
})

// Create a knowledge base provider instance
const kbProvider = await createKnowledgeBaseProvider(client, {
  knowledgeBaseId: 'your-knowledge-base-id', // REQUIRED
  modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0', // Optional
  region: 'us-east-1', // Optional
})

// Query the knowledge base
const response = await kbProvider('What is the purpose of the contracts service?')

// Access the response content
console.log('Response:', response.content)

// Access sources and metadata
if (response.sources && response.sources.length > 0) {
  console.log('Sources:', response.sources)
}
console.log('Metadata:', response.metadata)
```

### CLI Usage

You can use the knowledge base provider with the Hataraku CLI in several ways:

#### Using Command Line Option

```bash
npm run cli -- --provider knowledge-base --kb-id your-knowledge-base-id "Your query here"
```

#### Using Environment Variable

```bash
KB_ID=your-knowledge-base-id npm run cli -- --provider knowledge-base "Your query here"
```

#### Using Environment Variables for Both Knowledge Base ID and Model ARN

```bash
KB_ID=your-knowledge-base-id KB_MODEL_ARN="arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0" npm run cli -- --provider knowledge-base "Your query here"
```

#### Using a Profile with Knowledge Base Configuration

First, set up a profile with knowledge base configuration:

```bash
npm run cli -- profile set-kb your-profile
```

This will prompt you for:

- Knowledge Base ID (required)
- Model ARN (optional)
- AWS Region (optional)

Then, use the profile:

```bash
npm run cli -- --profile your-profile --provider knowledge-base "Your query here"
```

## Configuration Options

The knowledge base provider accepts the following configuration options:

| Option            | Type   | Required | Description                                                                 |
| ----------------- | ------ | -------- | --------------------------------------------------------------------------- |
| `knowledgeBaseId` | string | Yes      | The ID of your AWS Bedrock knowledge base                                   |
| `modelArn`        | string | No       | The ARN of the model to use for generation (defaults to Claude 3.5 Sonnet)  |
| `region`          | string | No       | The AWS region where your knowledge base is located (defaults to us-east-1) |
| `profile`         | string | No       | The AWS profile to use for credentials                                      |

## Response Format

The knowledge base provider returns responses in the following format:

```typescript
interface KnowledgeBaseResponse {
  content: string // The generated response text
  metadata?: Record<string, unknown> // Metadata about the response
  sources?: Array<{
    // Sources used to generate the response
    url?: string // URL of the source
    title?: string // Title of the source
    content?: string // Content snippet from the source
    metadata?: Record<string, unknown> // Additional metadata about the source
    sourceType?: string // Type of source (e.g., WEB, S3)
  }>
}
```

## Error Handling

The knowledge base provider includes comprehensive error handling for common issues:

```typescript
try {
  const response = await kbProvider('What is the capital of France?')
  console.log(response.content)
} catch (error) {
  console.error('Error:', error)
}
```

Common errors include:

- Missing knowledge base ID
- Invalid knowledge base ID
- AWS credentials issues
- Access denied errors
- Resource not found errors

## Examples

See the [knowledge-base.ts](../examples/knowledge-base.ts) example for a complete implementation.

## Best Practices

1. **Always provide a knowledge base ID**: This is required and must be provided via CLI, environment variable, or
   profile configuration.

2. **Use AWS profiles for credential management**: This is more secure than hardcoding credentials.

3. **Consider caching responses**: For frequently asked questions, consider implementing a caching layer.

4. **Handle errors gracefully**: Provide meaningful error messages to users when issues occur.

5. **Monitor usage**: Keep track of your AWS Bedrock usage to manage costs.

## Troubleshooting

### Common Issues

1. **"Knowledge Base ID is required" error**:

   - Ensure you've provided a knowledge base ID via CLI, environment variable, or profile configuration.

2. **"ExpiredTokenException" error**:

   - Your AWS credentials have expired. Refresh them using your AWS authentication method.

3. **"ResourceNotFoundException" error**:

   - The knowledge base ID you provided doesn't exist or isn't accessible with your credentials.

4. **"AccessDenied" error**:
   - Your AWS credentials don't have permission to access the knowledge base.

### Getting Help

If you encounter issues not covered here, please:

- Check the [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
- File an issue on the [Hataraku GitHub repository](https://github.com/turlockmike/hataraku/issues)
