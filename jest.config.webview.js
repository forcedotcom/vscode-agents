/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/test/webview/**/?(*.)+(spec|test).[t]s?(x)'],
  setupFilesAfterEnv: ['./scripts/setup-jest-webview.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/extension/',
    '/test/commands/',
    '/test/views/',
    '/test/services/'
  ],
  // Don't force coverage collection from untested files
  // collectCoverageFrom: [
  //   'webview/src/**/*.{ts,tsx}',
  //   '!webview/src/**/*.d.ts',
  //   '!webview/src/main.tsx',
  //   '!webview/src/vite-env.d.ts'
  // ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.svg$': '<rootDir>/test/__mocks__/fileMock.js',
    '^react$': '<rootDir>/webview/node_modules/react',
    '^react-dom$': '<rootDir>/webview/node_modules/react-dom'
  },
  moduleDirectories: ['node_modules', 'webview/node_modules'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: './tsconfig.test.json'
    }]
  },
  reporters: ['default', ['jest-junit', { outputName: 'junit-webview-tests.xml' }]],
  coverageReporters: ['lcov', 'text'],
  resetMocks: true
};
