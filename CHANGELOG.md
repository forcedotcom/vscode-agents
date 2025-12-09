# [1.5.0](https://github.com/salesforcecli/vsode-agents/compare/v1.4.0...v1.5.0) (2025-12-09)

### Features

- reset agent view and reload agents when SFDX org changes ([68ffa6e](https://github.com/salesforcecli/vsode-agents/commit/68ffa6eb10c9fe1c5a329a27bb9915d7c5c4152c))

# [1.4.0](https://github.com/salesforcecli/vsode-agents/compare/v1.2.0...v1.4.0) (2025-12-09)

### Features

- **Interactive Preview (Beta)**: Chat with your agents to test their responses and behavior.
- **Conversation Tracer (Beta)**: Deep-dive into how your agent processes requests, makes decisions, and executes actions.
- **Agent Validation (Beta)**: Ensure you have valid agentscript.

### Performance Improvements

- optimize test timeouts to reduce test execution time ([262ed94](https://github.com/salesforcecli/vsode-agents/commit/262ed94a5d6a067a4f6b3e6c6e337133df07f616))

# [1.2.0](https://github.com/salesforcecli/vsode-agents/compare/v1.1.3...v1.2.0) (2025-08-20)

### Features

- Chat with an active agent in your org with the new Agent Preview panel. Enable Debug Mode to automatically invoke the Apex Replay Debugger to debug Apex classes that are invoked as agent actions during the chat.
- Show generated data in agent test results by either enabling the new "Agentforce DX: Show Generated Data" setting or clicking the new square icon in the Agent Tests panel. Generated data, which is in JSON format, isn't displayed by default because it can get pretty long, depending on how complicated the action is.

## [1.1.3](https://github.com/salesforcecli/vsode-agents/compare/v1.1.2...v1.1.3) (2025-08-13)

### Bug Fixes

- add new context menu options to Active or Deactive Agents ([1adf73c](https://github.com/salesforcecli/vsode-agents/commit/1adf73c4539a85b1388a096d5116f74476e5427d))
- print generatedData results from AiEvaluation runs ([5a15d7a](https://github.com/salesforcecli/vsode-agents/commit/5a15d7a8957830a1903c90814e773e3c5fd0dea9))
- keep the test summary available([c8968b4](https://github.com/salesforcecli/vsode-agents/commit/c8968b47bfcca724a06a9b05b76b38f7babc371e))

## [1.1.2](https://github.com/salesforcecli/vsode-agents/compare/v1.1.1...v1.1.2) (2025-05-13)

### Bug Fixes

- properties to accommodate O11y reporter initialisation ([babf392](https://github.com/salesforcecli/vsode-agents/commit/babf3925016a36e7ff5f7f652dd8613ec5e445b9))

## [1.1.1](https://github.com/salesforcecli/vsode-agents/compare/v1.1.0...v1.1.1) (2025-05-08)

### Bug Fixes

- add metric output, bump library ([4e6e96e](https://github.com/salesforcecli/vsode-agents/commit/4e6e96ecb691f5b94a4c4e62a054690abc9a29d7))
- only show metric output if in test ([2ebb8e5](https://github.com/salesforcecli/vsode-agents/commit/2ebb8e52c9477a5b03cc82ddcab5bc44f3752306))
- remove preview ([430d78e](https://github.com/salesforcecli/vsode-agents/commit/430d78e15f1e96341617dcb8ea0ff448b3fcebdc))

# [1.1.0](https://github.com/salesforcecli/vsode-agents/compare/v1.0.0...v1.1.0) (2025-03-11)

### Bug Fixes

- remove `View Test Results` from command palette ([30a8c98](https://github.com/salesforcecli/vsode-agents/commit/30a8c98c90a252d635e4d7ca87867491560e0cd0))
- warn user if no test results are available ([37c305c](https://github.com/salesforcecli/vsode-agents/commit/37c305ce5d616eaa650a7b442b42449a71413035))

### Features

- support opening agents in MPD projects ([8d66749](https://github.com/salesforcecli/vsode-agents/commit/8d667494fb9e61fb69a710241de27c403785578c))

# [1.0.0](https://github.com/salesforcecli/vsode-agents/compare/v0.1.0...v1.0.0) (2025-02-26)

# 1.0.0 Open Beta Release

Welcome to the first (beta) release of the Agentforce DX VS Code extension! Agentforce DX is a suite of tools to build, preview, and test agents.

This extension depends on the Salesforce Extension Pack, Salesforce CLI, and the Agentforce DX CLI plugin ([@salesforcecli/plugin-agent](https://github.com/salesforcecli/plugin-agent)). For details about installing these prerequisites, see the [README](./README.md).

### Features in This Extension

- Run tests associated with an agent in the Agent Testing Panel.
- Open an agent in your org's Agent Builder UI.
