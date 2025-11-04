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
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.svg$': '<rootDir>/test/__mocks__/fileMock.js',
    '^react$': '<rootDir>/webview/node_modules/react',
    '^react-dom$': '<rootDir>/webview/node_modules/react-dom'
  },
  moduleDirectories: ['node_modules', 'webview/node_modules'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  reporters: ['default', ['jest-junit', { outputName: 'junit-webview-tests.xml' }]],
  coverageReporters: ['lcov', 'text'],
  resetMocks: true
};
