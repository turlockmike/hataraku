import { z } from 'zod';

export const ProfileOptionsSchema = z.object({
  stream: z.boolean().optional().default(true),
  sound: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(false)
});

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agent: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  options: ProfileOptionsSchema.optional()
});

export const ProfilesConfigSchema = z.object({
  activeProfile: z.string(),
  profiles: z.array(ProfileSchema)
});

export type ProfileOptions = z.infer<typeof ProfileOptionsSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;

// Default profile configuration
export const DEFAULT_PROFILE: Profile = {
  name: 'default',
  description: 'Default configuration using Claude',
  provider: 'anthropic',
  model: 'claude-3-opus',
  tools: ['ai-tools', 'dev-tools'],
  options: {
    stream: true,
    sound: true,
    interactive: false
  }
}; 