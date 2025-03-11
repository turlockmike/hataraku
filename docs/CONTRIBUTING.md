### Commands
- `npm run build` - Build all components
- `npm run dev` - Run CLI in development mode
- `npm run test` - Run Jest tests
- `npm run test src/path/to/test.test.ts` - Run single test
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run all type checks
- `npm run cli` - Run CLI in development mode
- `npm run cli:prod` - Run CLI in production mode

### Code Style
- TypeScript with strict types when possible
- camelCase for variables/methods, PascalCase for classes/types
- kebab-case for filenames
- No trailing semicolons
- Group imports: standard libs → external deps → internal
- Custom error classes with async/await and try/catch

### Guidelines
- Fork from `main` branch
- Add tests for new code
- Update docs for API changes
- Ensure tests pass and code lints
- Follow modular design principles
- Add JSDoc for public APIs

### Code Organization
- `src/` - Source code
  - `core/` - Core agent implementation
  - `cli/` - Command-line interface
  - `config/` - Configuration management
  - `utils/` - Utility functions
  - `shared/` - Shared types and constants
  - `services/` - Service implementations 