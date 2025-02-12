# Cursor Rules - Test Driven Development

## Overview
Cursor Rules provide a way to define and manage instructions for AI interactions within specific codebases. This document outlines the test-driven development approach for implementing cursor rules functionality.

## Core Types

```typescript
interface CursorRule {
  name: string;
  description: string;
  glob?: string[];
  instructions: string[];
  metadata?: Record<string, unknown>;
}

interface CursorRuleManager {
  addRule(rule: CursorRule): Promise<void>;
  getRuleByName(name: string): Promise<CursorRule | null>;
  getRulesByGlob(filePath: string): Promise<CursorRule[]>;
  listRules(): Promise<CursorRule[]>;
  removeRule(name: string): Promise<boolean>;
}
```

## Test Cases

### 1. Rule Creation and Retrieval
```typescript
describe('CursorRuleManager - Basic Operations', () => {
  test('should create and retrieve a rule by name', async () => {
    const manager = new CursorRuleManager();
    const rule: CursorRule = {
      name: 'test-rule',
      description: 'A test rule',
      instructions: ['Follow this guideline']
    };
    
    await manager.addRule(rule);
    const retrieved = await manager.getRuleByName('test-rule');
    expect(retrieved).toEqual(rule);
  });

  test('should return null for non-existent rule', async () => {
    const manager = new CursorRuleManager();
    const retrieved = await manager.getRuleByName('non-existent');
    expect(retrieved).toBeNull();
  });
});
```

### 2. Glob Pattern Matching
```typescript
describe('CursorRuleManager - Glob Matching', () => {
  test('should retrieve rules matching file path', async () => {
    const manager = new CursorRuleManager();
    const rule: CursorRule = {
      name: 'typescript-rule',
      description: 'TypeScript guidelines',
      glob: ['**/*.ts', '**/*.tsx'],
      instructions: ['Follow TypeScript best practices']
    };
    
    await manager.addRule(rule);
    const matches = await manager.getRulesByGlob('src/components/Button.tsx');
    expect(matches).toContainEqual(rule);
  });

  test('should return empty array for non-matching path', async () => {
    const manager = new CursorRuleManager();
    const matches = await manager.getRulesByGlob('src/styles.css');
    expect(matches).toHaveLength(0);
  });
});
```

### 3. Rule Management
```typescript
describe('CursorRuleManager - Management', () => {
  test('should list all rules', async () => {
    const manager = new CursorRuleManager();
    const rules: CursorRule[] = [
      {
        name: 'rule1',
        description: 'First rule',
        instructions: ['Instruction 1']
      },
      {
        name: 'rule2',
        description: 'Second rule',
        instructions: ['Instruction 2']
      }
    ];
    
    await Promise.all(rules.map(rule => manager.addRule(rule)));
    const listed = await manager.listRules();
    expect(listed).toHaveLength(2);
    expect(listed).toEqual(expect.arrayContaining(rules));
  });

  test('should remove existing rule', async () => {
    const manager = new CursorRuleManager();
    const rule: CursorRule = {
      name: 'temp-rule',
      description: 'Temporary rule',
      instructions: ['Temp instruction']
    };
    
    await manager.addRule(rule);
    const removed = await manager.removeRule('temp-rule');
    expect(removed).toBe(true);
    
    const retrieved = await manager.getRuleByName('temp-rule');
    expect(retrieved).toBeNull();
  });
});
```

## Implementation Plan

1. Core Implementation
   - Create `CursorRule` interface
   - Implement `CursorRuleManager` class with in-memory storage
   - Add validation for required fields
   - Implement glob pattern matching using `minimatch`

2. Storage Layer
   - Add persistence layer interface
   - Implement file-based storage
   - Add caching mechanism for frequently accessed rules

3. Integration
   - Integrate with existing agent system
   - Add rule fetching middleware
   - Implement rule application in agent prompts

4. CLI Support
   - Add commands for rule management
   - Implement rule import/export functionality
   - Add validation and error handling

## Usage Example

```typescript
import { CursorRuleManager } from './core/rules';

// Initialize manager
const ruleManager = new CursorRuleManager();

// Add a rule
await ruleManager.addRule({
  name: 'react-components',
  description: 'Guidelines for React components',
  glob: ['src/components/**/*.tsx'],
  instructions: [
    'Use functional components with hooks',
    'Follow component naming conventions',
    'Implement proper prop types'
  ]
});

// Use in agent
const agent = createAgent({
  name: 'Code Assistant',
  async beforePrompt(context) {
    const rules = await ruleManager.getRulesByGlob(context.filePath);
    return rules.flatMap(rule => rule.instructions);
  }
});
```

## Next Steps

1. [ ] Set up test environment with Jest
2. [ ] Implement core `CursorRule` interface
3. [ ] Create basic `CursorRuleManager` with in-memory storage
4. [ ] Write initial tests for basic operations
5. [ ] Implement glob pattern matching
6. [ ] Add persistence layer
7. [ ] Integrate with agent system
8. [ ] Add CLI commands
9. [ ] Document API and usage 