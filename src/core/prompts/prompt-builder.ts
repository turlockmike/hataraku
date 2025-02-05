import { DiffStrategy } from "../diff/DiffStrategy";
import { McpHub } from "../../services/mcp/McpHub";
import { getCapabilitiesSection } from "./sections/capabilities";
import { getCustomInstructionsSection, CustomInstructionsConfig } from "./sections/custom-instructions";
import { getMcpServersSection } from "./sections/mcp-server-creation";
import { getObjectiveSection } from "./sections/objective";
import { getRoleSection } from "./sections/role";
import { getRulesSection } from "./sections/rules";
import { getSystemInfoSection } from "./sections/system-info";
import { getToolUseGuidelinesSection } from "./sections/tool-use-guidelines";
import { getSharedToolUseSection } from "./sections/tool-use";

export interface SystemPromptSection {
  name: string;
  content: string;
  order: number;
  enabled: boolean;
}

export interface SystemPromptConfig {
  sections?: {
    capabilities?: {
      computerUse?: boolean;
      mcpSupport?: boolean;
      diffStrategy?: DiffStrategy;
    };
    customInstructions?: CustomInstructionsConfig;
    role?: {
      definition?: string;
    };
    rules?: {
      additionalRules?: string[];
      disabledRules?: string[];
    };
    systemInfo?: {
      additionalInfo?: Record<string, string>;
    };
    toolUse?: {
      additionalTools?: string[];
      disabledTools?: string[];
    };
    mcpServers?: {
      servers?: McpHub;
    };
    objective?: {
      customObjective?: string;
    };
  };
  customSections?: SystemPromptSection[];
  options?: {
    sectionOrder?: string[];
    disabledSections?: string[];
  };
}

export class SystemPromptBuilder {
  private sections: Map<string, SystemPromptSection>;
  private cwd: string;
  private defaultSections: Map<string, () => string>;

  constructor(config: SystemPromptConfig, cwd: string) {
    this.sections = new Map();
    this.cwd = cwd;
    this.defaultSections = new Map([
      ['role', () => getRoleSection(config.sections?.role?.definition)],
      ['tool-use', () => getSharedToolUseSection()],
      ['tool-use-guidelines', () => getToolUseGuidelinesSection()],
      ['rules', () => getRulesSection(
        this.cwd,
        config.sections?.capabilities?.computerUse ?? true,
        config.sections?.capabilities?.diffStrategy
      )],
      ['system-info', () => getSystemInfoSection(this.cwd)],
      ['objective', () => getObjectiveSection()]
    ]);
    this.initializeDefaultSections(config);
  }

  private getDefaultOrder(sectionName: string): number {
    const orderMap: Record<string, number> = {
      'role': 10,
      'tool-use': 20,
      'tool-use-guidelines': 30,
      'rules': 40,
      'system-info': 50,
      'objective': 60,
      'custom-instructions': 70
    };
    return orderMap[sectionName] || 100;
  }

  private initializeDefaultSections(config: SystemPromptConfig) {
    const { customSections = [], options = {} } = config;
    const disabledSections = options.disabledSections || [];

    // Initialize default sections in order
    const defaultSectionNames = Array.from(this.defaultSections.keys())
      .sort((a, b) => this.getDefaultOrder(a) - this.getDefaultOrder(b));

    for (const name of defaultSectionNames) {
      if (!disabledSections.includes(name)) {
        const getContent = this.defaultSections.get(name)!;
        const order = this.getDefaultOrder(name);
        this.sections.set(name, {
          name,
          content: getContent(),
          order,
          enabled: true
        });
      }
    }

    // Add custom sections
    for (const section of customSections) {
      if (!disabledSections.includes(section.name)) {
        this.sections.set(section.name, {
          ...section,
          enabled: true
        });
      }
    }

    // Add custom instructions if provided
    if (config.sections?.customInstructions) {
      const content = getCustomInstructionsSection(config.sections.customInstructions);
      if (content && !disabledSections.includes('custom-instructions')) {
        this.sections.set('custom-instructions', {
          name: 'custom-instructions',
          content,
          order: this.getDefaultOrder('custom-instructions'),
          enabled: true
        });
      }
    }
  }

  private formatSectionName(name: string): string {
    return name.split('-')
      .map(word => word.toUpperCase())
      .join(' ');
  }

  public addSection(section: SystemPromptSection): this {
    this.sections.set(section.name, {
      ...section,
      enabled: true
    });
    return this;
  }

  public disableSection(sectionName: string): this {
    const section = this.sections.get(sectionName);
    if (section) {
      section.enabled = false;
      this.sections.set(sectionName, section);
    }
    return this;
  }

  public enableSection(sectionName: string): this {
    if (this.defaultSections.has(sectionName)) {
      // Re-add default section with fresh content
      const getContent = this.defaultSections.get(sectionName)!;
      this.sections.set(sectionName, {
        name: sectionName,
        content: getContent(),
        order: this.getDefaultOrder(sectionName),
        enabled: true
      });
    } else {
      // Re-enable custom section if it exists
      const section = this.sections.get(sectionName);
      if (section) {
        section.enabled = true;
        this.sections.set(sectionName, section);
      }
    }
    return this;
  }

  public build(): string {
    // Get enabled sections
    const enabledSections = Array.from(this.sections.values())
      .filter(section => section.enabled)
      .sort((a, b) => a.order - b.order);

    if (enabledSections.length === 0) {
      return '';
    }

    // Build the prompt with proper section formatting
    const formattedSections = enabledSections.map(section => {
      const displayName = this.formatSectionName(section.name);
      return `${displayName}\n\n${section.content.trim()}`;
    });

    return formattedSections.join('\n\n====\n\n');
  }
}