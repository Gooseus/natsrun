# Contributing to NATSrun

Thank you for considering contributing to NATSrun! Here are the guidelines for contributing:

## 1. Issues
- Use GitHub Issues to report bugs or suggest features
- Include a clear description of the problem or feature request
- Provide relevant code examples or error messages
- Check if the issue already exists before creating a new one
- Create an Issue before you create a PR

## 2. Pull Requests
Prefer pull requests in this order:
1. **Explanation + Tests + Code**: The best contributions include:
   - A clear explanation of the change
   - Tests that verify the change
   - The actual code changes
2. **Explanation + Tests**: Good contributions include:
   - A clear explanation
   - Tests for the proposed change
3. **Explanation Only**: For any issues that need discussion before implementation

### PR Process
1. Fork the repository
2. Create a new branch for your feature/fix
3. Add tests if applicable
4. Run the test suite: `npm test`
5. Commit changes and reference your Issue (from #1)
6. Submit a pull request with a clear description

### Recommendations
- Write failing tests with empty implemtations and commit those first
- Prefer shorter functions with pure state and dependency injection for easier testing
- Use sensible and descriptive commit messages.
- Review your PR after submitting to add context to the file/code changes

### Code Style
- Use TypeScript
- Use Typedoc comments for major code entities (types, classes, methods) to generate documentation
- Use simple comments to explain motivations and/or complex logic
- Use Prettier

### Tests
- All new bug fixes and features should include tests
- Run `npm test` before submitting

## Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

## Questions?
Feel free to open an issue for any questions about contributing! 
