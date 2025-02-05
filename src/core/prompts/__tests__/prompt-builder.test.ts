import { SystemPromptBuilder, SystemPromptConfig } from '../prompt-builder';
import os from 'os'
import process from 'node:process'

describe('SystemPromptBuilder', () => {
  const testCwd = '/test/path';

  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue('/test/home')
    jest.spyOn(process, 'cwd').mockReturnValue('/test/cwd')
    jest.spyOn(os, 'platform').mockReturnValue('linux')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
  

  describe('constructor', () => {
    it('should initialize with default sections', () => {
      const config: SystemPromptConfig = {sections: {role: {definition: 'Test Role Definition'}, customInstructions: {instructions: 'Test Custom Instructions', language: 'English'}}};
      const builder = new SystemPromptBuilder(config, testCwd);
      const prompt = builder.build();
      
      // Check for unique content from each section
      const sections = prompt.split('====').filter(Boolean);
      expect(sections[0]).toContain('ROLE');
      expect(sections[1]).toContain('SYSTEM INFO');
      expect(sections[2]).toContain('TOOL USE');
      expect(sections[3]).toContain('TOOL USE GUIDELINES');
      expect(sections[4]).toContain('SCHEMA VALIDATION');
      expect(sections[5]).toContain('RULES');
      expect(sections[6]).toContain('OBJECTIVE');
      expect(sections[7]).toContain('CUSTOM INSTRUCTIONS');
    });

    it('should initialize with role and custom instructions', () => {
      const config: SystemPromptConfig = {
        sections: {
          role: {
            definition: 'Test Role Definition'
          },
          customInstructions: {
            instructions: 'Test Custom Instructions',
            language: 'English'
          }
        }
      };
      const builder = new SystemPromptBuilder(config, testCwd);
      const prompt = builder.build();
      
      expect(prompt).toContain('ROLE');
      expect(prompt).toContain('Test Role Definition');
      expect(prompt).toContain('Test Custom Instructions');
      expect(prompt).toContain('Language: English');
    });
  });

  describe('section management', () => {
    it('should allow disabling sections', () => {
      const config: SystemPromptConfig = {};
      const builder = new SystemPromptBuilder(config, testCwd);
      
      builder.disableSection('tool-use-guidelines');
      const prompt = builder.build();
      
      expect(prompt).not.toContain('TOOL USE GUIDELINES');
    });

    it('should allow enabling disabled sections', () => {
      const config: SystemPromptConfig = {
        options: {
          disabledSections: ['tool-use-guidelines']
        }
      };
      const builder = new SystemPromptBuilder(config, testCwd);
      
      builder.enableSection('tool-use-guidelines');
      const prompt = builder.build();
      
      expect(prompt).toContain('TOOL USE GUIDELINES');
    });

    it('should allow adding custom sections', () => {
      const config: SystemPromptConfig = {};
      const builder = new SystemPromptBuilder(config, testCwd);
      
      builder.addSection({
        name: 'custom-section',
        content: 'Custom Section Content',
        order: 15,
        enabled: true
      });
      
      const prompt = builder.build();
      expect(prompt).toContain('TOOL USE GUIDELINES');
      expect(prompt).toContain('CUSTOM SECTION');
    });
  });

  describe('section ordering', () => {
    it('should maintain correct section order', () => {
      const config: SystemPromptConfig = {
        customSections: [
          {
            name: 'first',
            content: 'First Content',
            order: 1,
            enabled: true
          },
          {
            name: 'last',
            content: 'Last Content',
            order: 100,
            enabled: true
          }
        ]
      };
      const builder = new SystemPromptBuilder(config, testCwd);
      const prompt = builder.build();
      
      const firstPosition = prompt.indexOf('First Content');
      const lastPosition = prompt.indexOf('Last Content');
      
      expect(firstPosition).toBeLessThan(lastPosition);
    });
  });

  describe('configuration options', () => {
    it('should respect disabled sections from config', () => {
      const config: SystemPromptConfig = {
        sections: {
          role: {
            definition: 'Test Role'
          },
          customInstructions: {
            instructions: 'Test Instructions',
            language: 'English'
          }
        },
        options: {
          disabledSections: ['tool-use-guidelines', 'objective']
        }
      };
      const builder = new SystemPromptBuilder(config, testCwd);
      const prompt = builder.build();
      
      expect(prompt).not.toContain('TOOL USE GUIDELINES');
      expect(prompt).not.toContain('OBJECTIVE');
      expect(prompt).toContain('ROLE');
      expect(prompt).toContain('CUSTOM INSTRUCTIONS');
    });

    it('should capture full system prompt structure', () => {
      const config: SystemPromptConfig = {
        sections: {
          role: {
            definition: 'Test Role'
          },
          customInstructions: {
            instructions: 'Test Instructions',
            language: 'English'
          },
          rules: {
            additionalRules: ['Test Rule'],
            disabledRules: ['some-rule']
          },
          systemInfo: {
            additionalInfo: {
              'Test Info': 'Value'
            }
          },
          toolUse: {
            additionalTools: ['test-tool'],
            disabledTools: ['some-tool']
          },
          objective: {
            customObjective: 'Test Objective'
          }
        }
      };
      const builder = new SystemPromptBuilder(config, testCwd);
      const prompt = builder.build();
      
      expect(prompt).toMatchSnapshot();
    });
  });
});
