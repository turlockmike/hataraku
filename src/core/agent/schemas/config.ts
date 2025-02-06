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

// Schema for SystemPromptSection
const systemPromptSectionSchema = z.object({
  name: z.string(),
  content: z.string(),
  order: z.number(),
  enabled: z.boolean(),
});

// Schema for SystemPromptConfig sections
const systemPromptSectionsSchema = z.object({
  capabilities: z.object({
    computerUse: z.boolean().optional(),
    mcpSupport: z.boolean().optional(),
    diffStrategy: z.string().optional(), // Changed from instanceof to string
  }).optional(),
  customInstructions: z.object({
    language: z.string().optional(),
    instructions: z.string().optional(),
  }).optional(),
  rules: z.object({
    additionalRules: z.array(z.string()).optional(),
    disabledRules: z.array(z.string()).optional(),
  }).optional(),
  systemInfo: z.object({
    additionalInfo: z.record(z.string()).optional(),
  }).optional(),
  toolUse: z.object({
    additionalTools: z.array(z.string()).optional(),
    disabledTools: z.array(z.string()).optional(),
  }).optional(),
  mcpServers: z.object({
    servers: z.any().optional(), // McpHub instance
  }).optional(),
  objective: z.object({
    customObjective: z.string().optional(),
  }).optional(),
}).optional();

// Schema for SystemPromptConfig
const systemPromptConfigSchema = z.object({
  sections: systemPromptSectionsSchema,
  customSections: z.array(systemPromptSectionSchema).optional(),
  options: z.object({
    sectionOrder: z.array(z.string()).optional(),
    disabledSections: z.array(z.string()).optional(),
  }).optional(),
}).optional();

// Updated agent config schema to use UnifiedTool and include systemPrompt
export const agentConfigSchema = z.object({
  name: z.string(),
  model: z.union([
    z.custom<ModelProvider>((val) => val && typeof (val as any).createMessage === 'function'),
    z.object({
      apiProvider: z.string(),
      apiModelId: z.string()
    })
  ]),
  tools: z.array(z.any()).optional(),
  role: z.string().optional(),
  customInstructions: z.string().optional(),
  systemPromptConfig: z.any().optional(),
  streaming: streamingConfigSchema.optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  timeout: z.number().positive().optional(),
}).strict();