/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/?(*.)+(spec|test).[t]s?(x)'],
  setupFilesAfterEnv: ['./scripts/setup-jest.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/', // Add this line to ignore the lib directory
    '/extension/',
    '/test/webview/', // Ignore webview tests (they use a separate config)
    '/test/integration/', // Ignore integration tests (they use a separate runner)
    '/.vscode-test/', // Ignore VS Code test installations
    'integration.test' // Ignore any files with "integration.test" in the name
  ],
  modulePathIgnorePatterns: [
    '/.vscode-test/' // Ignore VS Code test installations in module resolution
  ],
  reporters: ['default', ['jest-junit', { outputName: 'junit-custom-unitTests.xml' }]],
  coverageReporters: ['lcov', 'text'],
  resetMocks: true
};
