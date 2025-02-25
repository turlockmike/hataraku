# Hataraku Development Guide

## Build Commands
- Build all: `npm run build`
- Clean: `npm run clean`
- Dev mode: `npm run dev` 
- Type check: `npm run typecheck`
- Lint: `npm run lint`

## Testing Commands
- Run all tests: `npm test`
- Run single test: `npx jest src/path/to/test.test.ts`
- Run tests with pattern: `npx jest -t "test name pattern"`

## Code Style Guidelines
- **TypeScript**: Use strict types when possible (though `strict: false` is allowed in config)
- **Naming**: camelCase for variables/methods, PascalCase for classes/types/interfaces
- **Imports**: Group imports by source (standard libs → external deps → internal)
- **Error Handling**: Use custom error classes (see `core/errors.ts`) and async/await with try/catch
- **Testing**: Jest with mocks for external dependencies
- **Architecture**: Follow modular design with services, core components, and utilities separation
- **Formatting**: No trailing semicolons (see ESLint config)
- **Documentation**: Add JSDoc for public APIs, use markdown docs for larger concepts

## Current Work
- Current branch: `feat/DX-3323-hataraku-persistence`
- Working on persistence and profile management features