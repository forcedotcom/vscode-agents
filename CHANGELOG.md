# [1.7.0](https://github.com/salesforcecli/vsode-agents/compare/v1.6.0...v1.7.0) (2026-02-18)


### Bug Fixes

* add AgentSource mock to App coverage and integration tests ([3a110ef](https://github.com/salesforcecli/vsode-agents/commit/3a110efca13d5ccf9c4cc53fb5c143d54e5a4c38))
* add calls to sendException for error telemetry ([b0a24c5](https://github.com/salesforcecli/vsode-agents/commit/b0a24c5a3b5bbd63f8dcbe4bc91fd7a12428c053))
* add create agent button, default spec option ([4c45d30](https://github.com/salesforcecli/vsode-agents/commit/4c45d307b9244f82f3b9e4cac7699a1c362b636d))
* add error boundary to prevent blank screen on agent view crashes ([e54df6e](https://github.com/salesforcecli/vsode-agents/commit/e54df6eecaa318f62bbda63be13179787d4ab92d))
* add immediate UI feedback for restart options ([00aaeb4](https://github.com/salesforcecli/vsode-agents/commit/00aaeb45c0edc049ce57052fcc9a442930a024cb))
* add more details to output channel logging ([ab55d9c](https://github.com/salesforcecli/vsode-agents/commit/ab55d9c4adc578e7435c14f6e1d7b1a8ec6d02d0))
* add optimistic update for view title icons on session end ([3f0621b](https://github.com/salesforcecli/vsode-agents/commit/3f0621bf2846074ffd1ea2cbb26702e6049c7519))
* add org management extension as a dependency for auto-install ([df7a641](https://github.com/salesforcecli/vsode-agents/commit/df7a6412f377c2283ecdf0c353bfcc0a4c9df593))
* allow saving conversation from loaded history without active session ([55366a2](https://github.com/salesforcecli/vsode-agents/commit/55366a252e8559a8973dc829a4a7681c3521505a))
* always pass name to createAuthoringBundle for agent_label ([1aa4aa8](https://github.com/salesforcecli/vsode-agents/commit/1aa4aa8740dd9ad194231f259243059c26f318b7))
* always show button ([23396ba](https://github.com/salesforcecli/vsode-agents/commit/23396ba5d164cb1da4538d8c5b468d271bc33a13))
* always show folder picker when saving chat history ([5422c89](https://github.com/salesforcecli/vsode-agents/commit/5422c8905781405d1cd8679036cb3f1a313a8feb))
* clear SfProject cache on refresh to pick up new packageDirectories ([7167c3d](https://github.com/salesforcecli/vsode-agents/commit/7167c3d3b4d2bfbbfbb62952b8676214fed56e81))
* copy change ([169d1cf](https://github.com/salesforcecli/vsode-agents/commit/169d1cf71bce60493c7782b791a09e7ec5c503f6))
* default folder picker to project root and remove directory persistence ([3ce632e](https://github.com/salesforcecli/vsode-agents/commit/3ce632e2325bf75614534f675af210c521fb5eea))
* delete history from project .sfdx directory, not home directory ([ab4b6d9](https://github.com/salesforcecli/vsode-agents/commit/ab4b6d94e438de40e05902f004a68e9955bc75e0))
* disable Select Agent button when no agents available ([1c486f7](https://github.com/salesforcecli/vsode-agents/commit/1c486f7086f205a052e9355ba12052997098b18e))
* disable start button during session loading to prevent race conditions ([f8aff6a](https://github.com/salesforcecli/vsode-agents/commit/f8aff6a09c198fce9f77c59cbd5529f889f944c5))
* display trace history in chronological order (oldest first) ([bf9c3e4](https://github.com/salesforcecli/vsode-agents/commit/bf9c3e4e6c4f2ecb43f2e4c6f749fc8603c05539))
* eliminate visual blink when switching agents ([e246e18](https://github.com/salesforcecli/vsode-agents/commit/e246e1829c2af504a4a5360cd2a563ba1a9e46be))
* ensure UI is updated even when history directory doesn't exist ([57f8cd9](https://github.com/salesforcecli/vsode-agents/commit/57f8cd9f6a9dc4714d410569212386844db0cf8b))
* filter out test spec files from agent spec picker ([d61bcf6](https://github.com/salesforcecli/vsode-agents/commit/d61bcf69af188c2ace397cd35e4e20e7e4489746))
* handle both path separators in getAgentStorageKey for cross-platform support ([504d0be](https://github.com/salesforcecli/vsode-agents/commit/504d0be0845363d7f039da037026f8c78ac241cb))
* handle invalid user ID error on session start ([435e9ca](https://github.com/salesforcecli/vsode-agents/commit/435e9ca0cfd32fa4fc403544c88bfc6772a4db75))
* hide clear history button on error screen ([ac140d9](https://github.com/salesforcecli/vsode-agents/commit/ac140d9b3cc8c1acd570794f3ac0fc704bf69591))
* hide Select Agent button and disable dropdown when no agents available ([6f64a2d](https://github.com/salesforcecli/vsode-agents/commit/6f64a2d707479e16051352f731d3f99ed08650b2))
* hide tracer tab for published agents ([9a24e28](https://github.com/salesforcecli/vsode-agents/commit/9a24e289d280d2a8d0687717085fade9f1a2ac2f))
* improve command palette agent selection performance ([776fce0](https://github.com/salesforcecli/vsode-agents/commit/776fce0003a42e047fa2874a097a83e57d03cc17))
* improve tracer collapsible UI behavior and styling ([538b6dd](https://github.com/salesforcecli/vsode-agents/commit/538b6ddd01c9815de98eb191e58119ec115fdda9))
* load conversation history atomically with agent selection ([ce58eca](https://github.com/salesforcecli/vsode-agents/commit/ce58eca893697dc83592650e972b24ef08ee71fa))
* make Refresh Agent List use optimistic UI update ([8d7efbc](https://github.com/salesforcecli/vsode-agents/commit/8d7efbcfc3664cc71e360ab68390778bf1313ce8))
* make Reset Agent View use optimistic UI update ([5039de8](https://github.com/salesforcecli/vsode-agents/commit/5039de801ae894b3abbc000806be55d102bb48f4))
* make session ID scroll with trace history list ([a13f1c5](https://github.com/salesforcecli/vsode-agents/commit/a13f1c54aeeb2c2d8fcca58574898d819fa0a8fd))
* only show agents in defined packages ([554904d](https://github.com/salesforcecli/vsode-agents/commit/554904d984583f746139f8add48057891ddd3a15))
* pass agentSource in previewAgent selectAgent message ([d813649](https://github.com/salesforcecli/vsode-agents/commit/d813649d83a64d770fa91baf97fa1814e5a6b116))
* preserve currentAgentId and prevent redundant agent fetches ([abcf1f9](https://github.com/salesforcecli/vsode-agents/commit/abcf1f9b678ed4162078d2e0181b90626038fd2a))
* prevent auto-start of preview session on right-click menu ([bb67c16](https://github.com/salesforcecli/vsode-agents/commit/bb67c16ae960009f33ba9ab493a3b3212d88f3b4))
* remember last selected export directory as picker default ([c8d1ad3](https://github.com/salesforcecli/vsode-agents/commit/c8d1ad3a4d5dd31aacf4d3a59a412cf99e78584b))
* remove empty log line ([68d4382](https://github.com/salesforcecli/vsode-agents/commit/68d438258ceca114737ff23fef87e829e2787462))
* remove Invalid user ID error handling, use generic error boundary ([29a99f7](https://github.com/salesforcecli/vsode-agents/commit/29a99f7c82a30440c5e7bf486689d1edf65c8bd7))
* remove misleading step number from wizard comment ([083c86e](https://github.com/salesforcecli/vsode-agents/commit/083c86eaf8488180e2124cc147db057d66c1acf3))
* remove non-functional command ([681e0c8](https://github.com/salesforcecli/vsode-agents/commit/681e0c8a6f1224e0cbc7202f49b4b965a01bca36))
* remove redundant success notifications ([3dac674](https://github.com/salesforcecli/vsode-agents/commit/3dac67455d66111c669e687ddb190b5708a68ff5))
* remove unsupported argument from agent.publish call ([64fe49a](https://github.com/salesforcecli/vsode-agents/commit/64fe49a07b42cd763b3906359984cc0a3bb9e65a))
* remove unused exportConversationAs command and fix test ([d58a385](https://github.com/salesforcecli/vsode-agents/commit/d58a38574db155755a3701e2e219618b585cf244))
* robust JSONC parsing and semantic token color support ([ebbc2a2](https://github.com/salesforcecli/vsode-agents/commit/ebbc2a2091f00c33c4627d656fd93c28b44ce5cc))
* save session via library, remove .md generation ([58548d5](https://github.com/salesforcecli/vsode-agents/commit/58548d523d4afb8549ed140df4da270187b8095e))
* separate highlight prop from language label in CodeBlock ([a6e7332](https://github.com/salesforcecli/vsode-agents/commit/a6e73322067838d3c085b95c83374c4230bf82e8))
* set agent ID before opening view to fix timing issue ([7c1d534](https://github.com/salesforcecli/vsode-agents/commit/7c1d534993cb3413db2a5dada11625aff4d1c438))
* set session error state for compilation errors in startSession ([c3977a6](https://github.com/salesforcecli/vsode-agents/commit/c3977a617151da9ba8175f4732f24f47af244422))
* simplify Invalid user ID error check ([0e2d733](https://github.com/salesforcecli/vsode-agents/commit/0e2d733479bab8c5b25573923a94b5c48f003331))
* simplify no-agents message text and styling ([0bb205f](https://github.com/salesforcecli/vsode-agents/commit/0bb205f5d7c1c282759e2a20f7b5d080bb1bdac0))
* sort trace history on initial load and add bottom padding ([74667c1](https://github.com/salesforcecli/vsode-agents/commit/74667c1c6dabbbbb7984582fff0981227f9900ef))
* sort tracer messages chronologically by startExecutionTime ([a02ecab](https://github.com/salesforcecli/vsode-agents/commit/a02ecab9d1f771d5415344bdfc80fe29cfcb07ae))
* store export directory per-project using workspaceState ([9756c5b](https://github.com/salesforcecli/vsode-agents/commit/9756c5b7e178a3d1e9701cc96a6437c315f8897e))
* update AgentTracer tests to match renamed Open JSON button ([3d44bcd](https://github.com/salesforcecli/vsode-agents/commit/3d44bcdbeed73a45dcd643cdac063d3424e03ecb))
* update export icon label and dialog button to 'Save Chat History' ([1b2e41b](https://github.com/salesforcecli/vsode-agents/commit/1b2e41b9c23e347629195310aa8bd2c674518676))
* update integration test helpers for wizard-style UI ([a4820a8](https://github.com/salesforcecli/vsode-agents/commit/a4820a806e6dd776ffa230fc7713ad8390f6fcc8))
* update no-agents message and make it more subtle ([0a35c33](https://github.com/salesforcecli/vsode-agents/commit/0a35c33374981ffe7d53b037d9b2dc2d3bbe7915))
* update no-agents message text and style ([a5a6037](https://github.com/salesforcecli/vsode-agents/commit/a5a6037d41abf40dc94bcc329f5b001e455d324f))
* update PlaceholderContent test to match new no-agents message ([7e89507](https://github.com/salesforcecli/vsode-agents/commit/7e895072809b89efed4d53e75921c51aaec50e2d))
* update test mocks to work with main's WebviewMessageHandlers ([e7e96e6](https://github.com/salesforcecli/vsode-agents/commit/e7e96e60e6ab5538ff6d5fcb23ce3cd5e3abf6f7))
* update test to match NodeEntryStateStep label change ([86521ec](https://github.com/salesforcecli/vsode-agents/commit/86521ec9d916c5d083425f5bfa0da16c214655bc))
* update tests to match current onAgentChange and setSelectedAgentId signatures ([56f70e3](https://github.com/salesforcecli/vsode-agents/commit/56f70e373cc51e654c7881865cb1591a9877229a))
* update tests to match renamed Open JSON button ([d3df3d7](https://github.com/salesforcecli/vsode-agents/commit/d3df3d7aa847ecf41d506687e0a71e54a48218aa))
* use aabName for agent ID to match dropdown format ([2e3a29e](https://github.com/salesforcecli/vsode-agents/commit/2e3a29e9116081be46b8151325edeb64dc0b5095))
* use atomic setConversation message when clearing history ([618ddcf](https://github.com/salesforcecli/vsode-agents/commit/618ddcf03dc41877e5f6d07217485611f13eb467))
* use inline SVG for chevron icon to support dark themes ([4739361](https://github.com/salesforcecli/vsode-agents/commit/4739361c8247ffd6abe891875e38f7263b18f212))
* use setImmediate instead of setTimeout in headless UI mocks ([aad3b75](https://github.com/salesforcecli/vsode-agents/commit/aad3b7599c07d3e694b47c603dab4795e9762980))
* use style tag for theme colors to survive VS Code theme resets ([fa32b4c](https://github.com/salesforcecli/vsode-agents/commit/fa32b4c490ae126fd88439e3771856797388fe21))
* use TextMate prefix matching for theme scope resolution ([29ddcd9](https://github.com/salesforcecli/vsode-agents/commit/29ddcd9149de94142ae00e6e1a47721eefffc5ee))
* use trace execution time instead of load time for timestamps ([1c4969b](https://github.com/salesforcecli/vsode-agents/commit/1c4969b40f151c78e419e5314dc70bdc45764287))
* validate agent API name uniqueness during creation ([ba064c2](https://github.com/salesforcecli/vsode-agents/commit/ba064c267b8ce489c85eeea4a8933f07eaa5db3e))
* validate generated API name before accepting empty input ([52960d6](https://github.com/salesforcecli/vsode-agents/commit/52960d63348eea541cab155ef5580e9b20689800))
* wait for re-render in send message test ([8208704](https://github.com/salesforcecli/vsode-agents/commit/8208704538ae8de0c3a0c890521526991b15bf7d))


### Features

* add Apex badge to action steps in tracer timeline ([f988213](https://github.com/salesforcecli/vsode-agents/commit/f988213759aff84113c5f921230d8312519b80ec))
* add back navigation to create agent wizard ([331f0cd](https://github.com/salesforcecli/vsode-agents/commit/331f0cd6d1566d935b2aad778f6dbd56597dd16d))
* add clear history action to agent top bar ([a63fdd0](https://github.com/salesforcecli/vsode-agents/commit/a63fdd06d7573daa9086a04c61b381e9cf806255))
* add colors to output log via custom language ([bf07179](https://github.com/salesforcecli/vsode-agents/commit/bf071792d25a8b569eeb06b2b5f98206e84a4d5a))
* add command to show last trace payload ([0293306](https://github.com/salesforcecli/vsode-agents/commit/0293306fd3b7bcadbccf21030d35aaa38d53d0be))
* add copied feedback tooltip and adjust copy icon offset ([e5791b5](https://github.com/salesforcecli/vsode-agents/commit/e5791b5aec9adb73b4a5155d09e69fac716f18e0))
* add copy IDs button to trace row header ([3eca92e](https://github.com/salesforcecli/vsode-agents/commit/3eca92ee04482e60004139b1311de33a18c86cbe))
* add create agent toolbar icon and improve button layout ([8d31366](https://github.com/salesforcecli/vsode-agents/commit/8d3136649b24ef435f16eae8c95d4f07bfdb31ac))
* add custom tooltip for JSON icon button ([6828738](https://github.com/salesforcecli/vsode-agents/commit/68287386cdf5b64eefce3ad3b37fb0ec0b057ae1))
* add description step to create agent wizard ([b38cdee](https://github.com/salesforcecli/vsode-agents/commit/b38cdee6b9b18d29991f3964d9614be4aad8b2e0))
* add hover and selection highlighting to tracer timeline items ([7e1bb9a](https://github.com/salesforcecli/vsode-agents/commit/7e1bb9ac7e6f1336261cd8b7905dec66b9ea114b))
* add inline copy buttons to Session ID and Plan ID rows ([0520495](https://github.com/salesforcecli/vsode-agents/commit/0520495b732f73df85d5cb6e4d584117a77a4ee6))
* add JSON syntax highlighting to trace detail view ([183399b](https://github.com/salesforcecli/vsode-agents/commit/183399b4fc75eee7b62661db948d48bdefe2f179))
* add optimistic update for stop button ([dae21bd](https://github.com/salesforcecli/vsode-agents/commit/dae21bd218bb1c52f57b1d19da2f23148858a75a))
* add Save/Save As dropdown menu for export conversation ([8a2ec72](https://github.com/salesforcecli/vsode-agents/commit/8a2ec7283f930395e578fd5a9f8b51848e95e674))
* add SF_SKIP_RETRIEVE env var ([5c51e6d](https://github.com/salesforcecli/vsode-agents/commit/5c51e6d9e2ae677b0b4bf34339c71a1d45355d37))
* add unique icons for each tracer event type ([14ef3fa](https://github.com/salesforcecli/vsode-agents/commit/14ef3fa4e772631a12bc71b0ae894a68633d6edc))
* align authoring bundle wizard with CLI step order and add API name step ([df7919d](https://github.com/salesforcecli/vsode-agents/commit/df7919d2d182e343e4362869e6f515674a305b3c))
* auto-scroll timeline item into view on click ([3d9a36e](https://github.com/salesforcecli/vsode-agents/commit/3d9a36e413e44f734cdd0e2854c39898909577ac))
* display API name instead of label for published agents ([62aebfe](https://github.com/salesforcecli/vsode-agents/commit/62aebfe9668e65a20cbf40d73c5a3c99556df895))
* hide selector and tabs on error state ([9cf4d26](https://github.com/salesforcecli/vsode-agents/commit/9cf4d263ab9313d04f85e300caed13279e08e303))
* make expanded trace header sticky while scrolling ([aea2925](https://github.com/salesforcecli/vsode-agents/commit/aea2925174f171ad047469653f8cc4ca1fdfe1b4))
* refine tracer icons and remove unused ones ([c65d516](https://github.com/salesforcecli/vsode-agents/commit/c65d516935e7f0eacf61be10e2ad582c222cca15))
* remove destructive clear history and add history loading tests ([92b86ff](https://github.com/salesforcecli/vsode-agents/commit/92b86ff75c76471bae44303652df8e30c24cbe9a))
* replace Apex badge with action icon in tracer timeline ([770b80f](https://github.com/salesforcecli/vsode-agents/commit/770b80fed5524784bd5324e64f7329dd4e7e27c0))
* show original error details for all known error types ([cfaee2f](https://github.com/salesforcecli/vsode-agents/commit/cfaee2f6b89ad2fdf45f875d6ac3a4d751ce51b6))
* show technical error details for unknown server errors ([3cdc710](https://github.com/salesforcecli/vsode-agents/commit/3cdc7106e28c716b1a70f5eb30803a5fd6c0c4ad))
* show technical error details in error boundary ([3235b9a](https://github.com/salesforcecli/vsode-agents/commit/3235b9a66b46203b6f4ce7cbd3c685685176c0f3))
* sort agents alphabetically in picker and dropdown ([9439cb3](https://github.com/salesforcecli/vsode-agents/commit/9439cb3e313d5016175e5984dd978e4bcc7c6fbd))
* transform tracer select into collapsible UI ([2d5821a](https://github.com/salesforcecli/vsode-agents/commit/2d5821a232b5d98f165534b09faadc0c1895c141))
* two-step spec selection and auto-select new agent ([c6a47de](https://github.com/salesforcecli/vsode-agents/commit/c6a47dee398915f90e2ebc31516178e42e14449d))
* update chat input placeholder and hide during loading ([f463aea](https://github.com/salesforcecli/vsode-agents/commit/f463aeafa99486d054630bf10ecc689f9edc08d7))
* use editor theme token colors for JSON syntax highlighting ([33ae3d9](https://github.com/salesforcecli/vsode-agents/commit/33ae3d925171e9fd38f81adb57818fea393eeffb))
* use error boundary style display for server errors ([18c332d](https://github.com/salesforcecli/vsode-agents/commit/18c332d582a5598e7417bf788c7c5cac03c61267))
* use folder picker with persistence for export directory ([1263dae](https://github.com/salesforcecli/vsode-agents/commit/1263dae815d5dc6acd5843a6008c9ba2c7daec7f))


### Reverts

* Revert "refactor: move session ID to top-level banner in tracer panel" ([26ec355](https://github.com/salesforcecli/vsode-agents/commit/26ec35565d3955d4ce1540bdbe09057a5a38622c))
* move session ID back into each trace row ([ae6301e](https://github.com/salesforcecli/vsode-agents/commit/ae6301e0af7c2ecd2306c163a1536ed29c0e8f08))
* restore skipRetrieve argument in agent.publish ([568afdb](https://github.com/salesforcecli/vsode-agents/commit/568afdbdb12827dce9118dd8fd103d03870d793d))



# [1.6.0](https://github.com/salesforcecli/vsode-agents/compare/v1.5.1...v1.6.0) (2025-12-11)

### Bug Fixes

- use consistent line color for error state in timeline ([667028f](https://github.com/salesforcecli/vsode-agents/commit/667028fcec76e02bd95b99d4471d62415e7000f7))
- use error color for timeline error icon background ([1390638](https://github.com/salesforcecli/vsode-agents/commit/139063818fe1148918f81f0c6737f0687419dd42))

### Features

- render FunctionStep as Action Executed with error handling ([e808764](https://github.com/salesforcecli/vsode-agents/commit/e80876422cd50faabf5b845a45fe09de31b83155))

## [1.5.1](https://github.com/salesforcecli/vsode-agents/compare/v1.5.0...v1.5.1) (2025-12-09)

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
