# Contributing to Hataraku CLI

We love your input! We want to make contributing to Hataraku CLI as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html)

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issue tracker](https://github.com/turlockmike/hataraku/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/turlockmike/hataraku/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Process

1. Clone the repository:
   ```bash
   git clone https://github.com/turlockmike/hataraku.git
   cd hataraku
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes and test them:
   ```bash
   npm run build
   npm test
   ```

5. Commit your changes:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

6. Push to your fork and submit a pull request.

## Build Commands

- Build all: `npm run build`
- Clean: `npm run clean`
- Dev mode: `npm run dev` 
- Type check: `npm run typecheck`
- Lint: `npm run lint`

## Testing

We use Jest for testing. Please write tests for new code you create. Run the test suite with:

```bash
npm test
```

Additional testing commands:
- Run single test: `npx jest src/path/to/test.test.ts`
- Run tests with pattern: `npx jest -t "test name pattern"`

## Coding Style

- We use TypeScript for type safety
- We use ESLint for linting
- We follow a consistent code style
- We use meaningful variable names
- We write comments for complex logic

**Additional Style Guidelines:**
- **TypeScript**: Use strict types when possible (though `strict: false` is allowed in config)
- **Naming**: camelCase for variables/methods, PascalCase for classes/types/interfaces
- **Imports**: Group imports by source (standard libs → external deps → internal)
- **Error Handling**: Use custom error classes (see `core/errors.ts`) and async/await with try/catch
- **Architecture**: Follow modular design with services, core components, and utilities separation
- **Formatting**: No trailing semicolons (see ESLint config)
- **Documentation**: Add JSDoc for public APIs, use markdown docs for larger concepts

**ESLint Rules:**
- **Filenames**: Use kebab-case for filenames (`example-file.ts`) with test files as exceptions
- **Import Names**: Use camelCase or PascalCase for imports
- **Code Style**:
  - Always use curly braces for control statements
  - Use strict equality (`===` and `!==`)
  - Don't throw literals (use Error objects)

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## References

This document was adapted from the open-source contribution guidelines for [Facebook's Draft](https://github.com/facebook/draft-js/blob/a9316a723f9e918afde44dea68b5f9f39b7d9b00/CONTRIBUTING.md).