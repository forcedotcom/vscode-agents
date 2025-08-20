# [1.2.0](https://github.com/salesforcecli/vsode-agents/compare/v1.1.3...v1.2.0) (2025-08-20)

### Bug Fixes

- add up arrow for history, more natural chat input ([55f5456](https://github.com/salesforcecli/vsode-agents/commit/55f545630b28638d68587475c31507a22be3f9ee))
- add verbose toggle ([4819f59](https://github.com/salesforcecli/vsode-agents/commit/4819f5952caf23fccfb1079e9778b414a7c26549))
- agent chat working, back and forth ([1a5e91a](https://github.com/salesforcecli/vsode-agents/commit/1a5e91a84fc8d5b89ae55055c9cbbf314d7f588d))
- auto launch to breakpoint ([85c1f54](https://github.com/salesforcecli/vsode-agents/commit/85c1f543fda15bc85f15658be1950b2ef38e7c5a))
- both apps build and display ([f2d8771](https://github.com/salesforcecli/vsode-agents/commit/f2d8771f6d9ee0bf0ab9254de36fa6745c14670f))
- context menu correct - not working ([6647fac](https://github.com/salesforcecli/vsode-agents/commit/6647face71a66607c3df093a9aecb7dc11b5f5cf))
- new react app building ([8b408d2](https://github.com/salesforcecli/vsode-agents/commit/8b408d2d6ca16361032760b3f3482eb8098fa5e4))
- passing data with Lifecycle listners back and forth, real data in trace ([8ab9fb0](https://github.com/salesforcecli/vsode-agents/commit/8ab9fb0f6a26cc6dd36ae4fab8ff136ff7250e7c))
- reset button targets target-org ([b219248](https://github.com/salesforcecli/vsode-agents/commit/b219248e72811684ab00b402d4dd0b63be83b3ee))
- setting to auto-hide tracer ([de03067](https://github.com/salesforcecli/vsode-agents/commit/de03067cff0a4880ce4ab5db4f1b01d9c4de761f))
- use clientApp auth, handle 0, 2+ via prompt/error ([40b6f0d](https://github.com/salesforcecli/vsode-agents/commit/40b6f0d83539682f462a570df7bebcb27211dff9))

### Features

- add support for getting apex debug logs during agent conversation ([a651e4f](https://github.com/salesforcecli/vsode-agents/commit/a651e4f3829f85a7a97d11c086fc130cfefcb41a))
- chat as a view in sidebar and webview in editor from chat button ([c51a5fe](https://github.com/salesforcecli/vsode-agents/commit/c51a5fed93c6fe990c4373d15726f5cbfbfc527e))
- end session and ui for selecting an agent ([932cc61](https://github.com/salesforcecli/vsode-agents/commit/932cc61a44109c5fa098ec58af166a66a8bbf39d))
- initial commit for agent steps webview ([8f92ab4](https://github.com/salesforcecli/vsode-agents/commit/8f92ab421a5a73175ee3d49471fb505c6216bfa5))
- launch apex replay debugger view from agent preview ([f85d188](https://github.com/salesforcecli/vsode-agents/commit/f85d1885c9bedd6247f9c5ae51f552c4eb7d76b1))
- select agent to start session ([121918c](https://github.com/salesforcecli/vsode-agents/commit/121918cd13bb9c494e2433ab3f3135a82ad3db7b))

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
