import { DiffStrategy } from "../diff/DiffStrategy";
import { McpHub } from "../../services/mcp/McpHub";
import { getCapabilitiesSection } from "./sections/capabilities";
import { addCustomInstructions } from "./sections/custom-instructions";
import { getMcpServersSection } from "./sections/mcp-servers";
import { getObjectiveSection } from "./sections/objective";
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
    customInstructions?: {
      language?: string;
      instructions?: string;
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

  constructor(config: SystemPromptConfig, cwd: string) {
    this.sections = new Map();
    this.cwd = cwd;
    this.initializeDefaultSections(config);
  }

  private async initializeDefaultSections(config: SystemPromptConfig) {
    const {
      sections: {
        capabilities,
        customInstructions,
        rules,
        systemInfo,
        toolUse,
        mcpServers,
        objective
      } = {},
      customSections = [],
      options = {}
    } = config;

    // Initialize default sections with their content and order
    const defaultSections: SystemPromptSection[] = [
      {
        name: 'tool-use',
        content: getSharedToolUseSection(),
        order: 10,
        enabled: true
      },
      {
        name: 'tool-use-guidelines',
        content: getToolUseGuidelinesSection(),
        order: 20,
        enabled: true
      },
      {
        name: 'capabilities',
        content: getCapabilitiesSection(
          this.cwd,
          capabilities?.computerUse ?? true,
          mcpServers?.servers,
          capabilities?.diffStrategy
        ),
        order: 30,
        enabled: true
      },
      {
        name: 'mcp-servers',
        content: await getMcpServersSection(mcpServers?.servers, capabilities?.diffStrategy),
        order: 40,
        enabled: mcpServers?.servers !== undefined
      },
      {
        name: 'rules',
        content: getRulesSection(
          this.cwd,
          capabilities?.computerUse ?? true,
          capabilities?.diffStrategy
        ),
        order: 50,
        enabled: true
      },
      {
        name: 'system-info',
        content: getSystemInfoSection(this.cwd),
        order: 60,
        enabled: true
      },
      {
        name: 'objective',
        content: getObjectiveSection(),
        order: 70,
        enabled: true
      }
    ];

    // Add custom instructions if provided
    if (customInstructions) {
      const customInstructionsContent = await addCustomInstructions(
        customInstructions.instructions || '',
        this.cwd,
        customInstructions.language
      );
      if (customInstructionsContent) {
        defaultSections.push({
          name: 'custom-instructions',
          content: customInstructionsContent,
          order: 80,
          enabled: true
        });
      }
    }

    // Initialize sections map with defaults
    for (const section of defaultSections) {
      if (!options.disabledSections?.includes(section.name)) {
        this.sections.set(section.name, section);
      }
    }

    // Add custom sections
    for (const section of customSections) {
      if (!options.disabledSections?.includes(section.name)) {
        this.sections.set(section.name, section);
      }
    }
  }

  public addSection(section: SystemPromptSection): this {
    this.sections.set(section.name, section);
    return this;
  }

  public disableSection(sectionName: string): this {
    const section = this.sections.get(sectionName);
    if (section) {
      section.enabled = false;
    }
    return this;
  }

  public enableSection(sectionName: string): this {
    const section = this.sections.get(sectionName);
    if (section) {
      section.enabled = true;
    }
    return this;
  }

  public build(): string {
    // Get enabled sections
    const enabledSections = Array.from(this.sections.values())
      .filter(section => section.enabled);
    
    // Sort by order
    const orderedSections = enabledSections
      .sort((a, b) => a.order - b.order);

    // Combine sections
    return orderedSections
      .map(section => section.content)
      .join('\n\n');
  }
}