# Contributing to Hataraku CLI

## Build and Development Commands

Hataraku uses a comprehensive set of npm scripts for development:

### Core Build Commands

- `npm run build` - Build all components (cleans, builds CJS, ESM, CLI, and copies audio files)

### Development Commands

- `npm run dev` - Run the CLI in development mode with OpenRouter API key from .env
- `npm run cli` - Run the CLI directly using tsx
- `npm run cli:prod` - Run CLI in production mode
- `npm run example` - Run examples (use `npm run example -- <example-name>` for specific examples)
- `npm start` - Run the built CLI

### Quality Assurance

- `npm run typecheck` - Run all type checks
- `npm run lint` - Run ESLint on source files
- `npm test` - Run Jest tests
- `npm run test src/path/to/test.test.ts` - Run single test

### Release Process

- `npm run changeset` - Create a new changeset for version management
- `npm run version-packages` - Update versions based on changesets
- `npm run release` - Publish to npm
- `npm run prepublishOnly` - Clean and build before publishing

## Other Commands

- Check package.json for all commands not listed above.

## Testing

We use Jest for testing. Please write tests for new code you create. Run the test suite with:

```bash
npm test
```

Additional testing commands:

- Run single test: `npm run test src/path/to/test.test.ts`
- Run tests with pattern: `npm run test -t "test name pattern"`

## Coding Style

- TypeScript with strict types when possible (though `strict: false` is allowed in config)
- camelCase for variables/methods, PascalCase for classes/types/interfaces
- kebab-case for filenames (`example-file.ts`) with test files as exceptions
- No trailing semicolons
- Group imports by source (standard libs → external deps → internal)
- Custom error classes with async/await and try/catch
- Follow modular design principles
- Add JSDoc for public APIs

**ESLint Rules:**

- **Import Names**: Use camelCase or PascalCase for imports
- **Code Style**:
  - Always use curly braces for control statements
  - Use strict equality (`===` and `!==`)
  - Don't throw literals (use Error objects)

## Project Structure

Hataraku is organized as follows:

- `src/` - Source code
  - `core/` - Core functionality and agent implementation
    - `__tests__/` - Test files for core functionality (similar for other folders)
  - `cli/` - Command-line interface implementation
  - `config/` - Configuration management
  - `utils/` - Utility functions
  - `shared/` - Shared types and constants
  - `services/` - Service implementations
- `examples/` - Example code demonstrating various features
- `docs/` - Documentation
- `dist/` - Build output (generated)

## Dependencies

Hataraku uses several key dependencies:

- **AI and LLM Integration**

  - `ai`: Core AI SDK for text generation
  - `@anthropic-ai/sdk`: Anthropic Claude integration
  - `@openrouter/ai-sdk-provider`: OpenRouter integration
  - `@ai-sdk/amazon-bedrock`: AWS Bedrock integration
  - `@modelcontextprotocol/sdk`: MCP protocol support

- **CLI and User Interface**

  - `commander`: Command-line interface framework
  - `@inquirer/prompts`: Interactive command-line prompts
  - `chalk`: Terminal text styling

- **Development Tools**
  - `typescript`: Type safety
  - `jest`: Testing framework
  - `eslint`: Code linting
  - `husky`: Git hooks
  - `changesets`: Version management
