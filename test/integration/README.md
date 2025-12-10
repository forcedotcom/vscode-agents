# Integration Tests

This directory contains end-to-end integration tests for the VS Code extension. These tests are similar to CLI plugin NUTs (Non-Unit Tests) and use an authenticated DevHub to create scratch orgs.

## Prerequisites

1. **DevHub Authentication**: You need a DevHub org authenticated via the Salesforce CLI
   - Authenticate using: `sf org login web --alias devhub` or `sf org login jwt`
   - Set the `TESTKIT_HUB_USERNAME` environment variable to your DevHub username

2. **Dependencies**: All npm dependencies should be installed
   ```bash
   npm install
   ```

## Running Tests

### Run all integration tests:
```bash
npm run test:integration
```

This will:
1. Build the extension
2. Compile the integration test TypeScript files
3. Download VS Code (if needed)
4. Install required extension dependencies
5. Launch VS Code with the extension loaded
6. Run the integration tests

### Running a specific test:

The test runner will automatically discover and run all `.nut.test.ts` files in the `suite/` directory (compiled to `.nut.test.js`).

## Test Structure

- `runTest.ts` - Main test runner that launches VS Code and runs tests
- `suite/index.ts` - Test suite entry point that loads all test files
- `suite/helpers.ts` - Helper functions for:
  - Extension activation
  - DevHub authentication
  - Scratch org creation/deletion
  - Command availability checks
  - Diagnostic waiting
- `suite/*.nut.test.ts` - Individual NUT (Non-Unit Test) files
  - Uses `.nut.test.ts` extension to distinguish from unit tests (following CLI plugin convention)
  - Compiled to `.nut.test.js` in the `out` directory
  - **All NUTs must be headless CI/CD friendly** - use `headlessUiHelpers.ts` to mock UI interactions
- `suite/headlessUiHelpers.ts` - Helper utilities for mocking VS Code UI in headless environments
  - Automatically handles `showInputBox`, `showQuickPick`, `showInformationMessage`, etc.
  - Required for all NUTs to work in CI/CD systems without display
- `fixtures/test-workspace/` - Test workspace with sample agent files

## Current Tests

### Agent Compilation Test

Tests that an agent script file can be compiled using the `validateAgent` command (triggered via right-click context menu).

**What it does:**
1. Authenticates with DevHub (if `TESTKIT_HUB_USERNAME` is set)
2. Creates a scratch org from the DevHub (or uses existing org if `TESTKIT_ORG_USERNAME` is set)
3. Opens a test agent file
4. Executes the `validateAgent` command (simulating right-click menu)
5. Waits for compilation to complete
6. Verifies compilation succeeded (no error diagnostics)
7. Cleans up the scratch org (if created)

**Environment Variables:**
- `TESTKIT_HUB_USERNAME` - (Required for scratch org creation) Username or alias of the DevHub org. Matches [cli-plugins-testkit](https://github.com/salesforcecli/cli-plugins-testkit) convention.
- `TESTKIT_ORG_USERNAME` - (Optional) Username of an existing org to use instead of creating a scratch org. Matches testkit convention.

## CI/CD Usage

For CI/CD systems, ensure:
1. `TESTKIT_HUB_USERNAME` environment variable is set
2. The DevHub org is authenticated (via JWT or other CI-friendly method)
3. Sufficient timeouts are set (scratch org creation can take 2-5 minutes)

**Alternative**: Set `TESTKIT_ORG_USERNAME` to use an existing org instead of creating a scratch org. This is faster and useful for CI/CD when you want to reuse orgs.

## Environment Variables (matching cli-plugins-testkit)

This test framework follows the [cli-plugins-testkit](https://github.com/salesforcecli/cli-plugins-testkit) environment variable naming convention:

| Variable | Description | Required |
|----------|-------------|----------|
| `TESTKIT_HUB_USERNAME` | Username of an existing, authenticated DevHub org | For scratch org creation |
| `TESTKIT_ORG_USERNAME` | Username of an existing org to use (instead of creating scratch org) | Optional |

## Headless CI/CD Compatibility

**All NUTs must be headless-friendly** to work in CI/CD systems without a display. Use the `headlessUiHelpers` module to automatically mock all UI interactions:

```typescript
import { mockHeadlessUI } from './headlessUiHelpers';

// In your test:
const mockedUI = mockHeadlessUI({
  inputBoxResponses: ['MyBundleName'],      // Auto-respond to input boxes
  quickPickResponses: ['option1']            // Auto-select quick pick items
});

try {
  // Execute command - UI will be automatically handled
  await vscode.commands.executeCommand('my-command');
  
  // Verify UI was called
  assert.ok(mockedUI.inputBoxCalls() > 0);
} finally {
  mockedUI.restore(); // Always restore original functions
}
```

The `mockHeadlessUI` helper automatically:
- Mocks `showInputBox` to return configured responses
- Mocks `showQuickPick` to auto-select items
- Mocks `showInformationMessage` and `showErrorMessage` to auto-dismiss
- Tracks call counts for verification
- Provides a `restore()` function to clean up

## Local Development

If `TESTKIT_HUB_USERNAME` is not set, tests will still run but may skip authentication-dependent steps. This is useful for local development when you don't have a DevHub available.

