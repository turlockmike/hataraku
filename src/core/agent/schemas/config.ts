import { z } from 'zod';
import { ModelProvider } from '../../../api';
import { ModelConfiguration } from '../../../shared/api';

// Schema for ModelConfiguration
const modelConfigurationSchema = z.object({
  apiProvider: z.string(),
  apiModelId: z.string().optional(),
  id: z.string().optional(),
}).passthrough(); // Allow additional properties from ModelProviderOptions

// Schema for ModelProvider interface
const modelProviderSchema = z.object({
  createMessage: z.function(),
  getModel: z.function(),
});

// Combined model schema that accepts either ModelProvider or ModelConfiguration
const modelSchema = z.union([modelProviderSchema, modelConfigurationSchema]);

export const streamingConfigSchema = z.object({
  enabled: z.boolean(),
  chunkSize: z.number().positive().optional(),
  maxDelay: z.number().positive().optional(),
});

// Updated agent config schema to use UnifiedTool
export const agentConfigSchema = z.object({
  model: modelSchema,
  tools: z.array(z.object({
    name: z.string().min(1),
    description: z.union([z.string(), z.function()]),
    parameters: z.record(z.object({
      required: z.boolean(),
      description: z.union([z.string(), z.function()]),
    })),
    inputSchema: z.object({
      type: z.literal('object'),
      properties: z.record(z.any()),
      required: z.array(z.string()),
      additionalProperties: z.boolean(),
    }),
    outputSchema: z.object({
      type: z.literal('object'),
      properties: z.record(z.any()),
      required: z.array(z.string()),
      additionalProperties: z.boolean(),
    }),
    execute: z.function(),
    initialize: z.function().optional(),
  })),
  streaming: streamingConfigSchema.optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  timeout: z.number().positive().optional(),
}).strict();