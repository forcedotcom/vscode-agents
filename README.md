# Agentforce DX for Visual Studio Code

Agentforce DX is a suite of tools to build, preview, and test agents. This extension provides integrated VS Code commands to easily open an agent in your org's Agent Builder UI, run the tests associated with an agent in the Agent Testing Panel, and have a preview conversation with an active agent.

## Prerequisites

1. Install the [Salesforce Extension Pack and Salesforce CLI](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/install.html).
2. The Agentforce DX CLI plugin is JIT, which means it's automatically installed the first time you run an `agent` CLI command. But you can also install the plugin manually by running this command from VS Code's integrated terminal:

   ```bash
   sf plugins install agent
   ```

## How to Use this Extension

Here are the high-level features of this extension.

### Test Agents

Run agent tests by viewing them in the Agent Testing Panel. Click on either a test definition or test case to get more information about it.

   ![Run agent tests from the VS Code testing panel](images/afdx-test-panel.gif)

### Preview An Agent and Debug the Conversation

Preview an agent by chatting with it to to see how it responds to your statements, questions, and commands (also known as _utterances_). These conversation previews serve as interactive tests to make sure the agent behaves as expected. If an agent action that's implemented with an Apex class doesn't seem to be working correctly, you can chat in Debug Mode, which enables easy integration with the Apex Replay Debugger. Here's an overview of the steps. 

1. Complete the [prerequisites](https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html#prerequisites) in the org that contains your agent. Prerequisites include creating a new connected app and locally reauthorizing the org to link the new connected app.
2. In VS Code, in the Activity Bar, click the Agentforce DX icon. The Agent Preview pane opens.
3. In the `Select an agent..` drop-down, select the agent you want to converse with.  Only active agents are listed.
4. If you want to use the Apex Reply Debugger to debug issues with Apex classes, enable `Debug Mode`.
5. In the chat window, start chatting with your agent.
6. To invoke the Apex Reply Debugger, set a breakpoint in the Apex class you want to debug. Then start chatting again.  As soon as an agent action invokes that Apex class, the Apex Replay Debugger automatically starts, and you can debug as usual.  See [Apex Replay Debugger](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/replay-debugger.html) for details. 

### Open, Activate, or Deactivate an Agent in Agent Builder

Open an agent in the Agent Builder UI of your org by running the **SFDX: Open Agent in Default Org** command from the command palette. You can also run the same command by right-clicking any of these metadata components in your DX project package directory:

   - Bot (file extension `.bot-meta.xml`)
   - BotVersion (file extension `.botVersion-meta.xml`)
   - GenAiPlannerBundle (file extension `.genAiPlannerBundle`)

Similarly, activate or deactivate an agent in your org by running the **SFDX: Activate Agent** or **SFDX: Deactivate Agent** commands from the command palette or by right-clicking the agent's metadata files.

   ![Open an agent in an org using a VS Code command](images/afdx-open-org.gif)

## Documentation

For details about the features in this VS Code extension, and generally more information about Agentforce DX, see the **Build Agents with Agentforce DX** section of the [Agentforce Developer Guide](https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx.html).

## Bugs and Feedback

To report issues with this Agentforce DX extension, open a bug on [GitHub](https://github.com/forcedotcom/cli/issues). To suggest a new feature, start a [GitHub discussion](https://github.com/forcedotcom/cli/discussions).
