# Directory Structure

```
examples/agents/
├── base.ts                 # Base agent implementation
├── IMPLEMENTATION.md       # Implementation details
├── STRUCTURE.md           # This file
├── workflows/             # Workflow agents
│   ├── prompt_chain.ts    # Sequential processing agent
│   ├── parallel.ts        # Concurrent execution agent
│   └── evaluator.ts       # Quality evaluation agent
├── specialized/           # Specialized agents
│   ├── planner.ts         # Task planning agent
│   ├── executor.ts        # Execution agent
│   └── validator.ts       # Validation agent
├── interfaces/            # Common interfaces
│   ├── types.ts           # Type definitions
│   ├── tools.ts           # Tool interfaces
│   └── results.ts         # Result interfaces
└── tests/                # Test suites
    ├── workflows/         # Workflow tests
    ├── specialized/       # Specialized agent tests
    └── integration/       # Integration tests
```

## File Purposes

### Core Files
- `base.ts`: Foundation for all agents with common functionality
- `IMPLEMENTATION.md`: Detailed implementation plan
- `STRUCTURE.md`: Directory structure documentation

### Workflow Agents
- `prompt_chain.ts`: Sequential prompt processing implementation
- `parallel.ts`: Concurrent task execution implementation
- `evaluator.ts`: Quality evaluation and improvement implementation

### Specialized Agents
- `planner.ts`: Task planning and resource allocation
- `executor.ts`: Tool-based task execution
- `validator.ts`: Output validation and quality assurance

### Interfaces
- `types.ts`: Common TypeScript interfaces and types
- `tools.ts`: Tool integration interfaces
- `results.ts`: Standardized result formats

### Tests
- `workflows/`: Tests for workflow agents
- `specialized/`: Tests for specialized agents
- `integration/`: Cross-agent integration tests 