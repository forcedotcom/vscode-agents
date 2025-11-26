/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as packageJson from '../package.json';

describe('package.json', () => {
  describe('menu configurations', () => {
    describe('view/title menus', () => {
      const viewTitleMenus = packageJson.contributes.menus['view/title'];

      it('should have restart agent command visible only when session is active and not starting', () => {
        const restartCommand = viewTitleMenus.find((menu: any) => menu.command === 'sf.agent.combined.view.refresh');

        expect(restartCommand).toBeDefined();
        expect(restartCommand?.when).toContain('agentforceDX:sessionActive');
        expect(restartCommand?.when).toContain('!agentforceDX:sessionStarting');
      });

      it('should have refresh agents command visible only when session is not active or starting', () => {
        const refreshAgentsCommand = viewTitleMenus.find(
          (menu: any) => menu.command === 'sf.agent.combined.view.refreshAgents'
        );

        expect(refreshAgentsCommand).toBeDefined();
        expect(refreshAgentsCommand?.when).toContain('!agentforceDX:sessionActive');
        expect(refreshAgentsCommand?.when).toContain('!agentforceDX:sessionStarting');
        expect(refreshAgentsCommand?.when).toContain('!agentforceDX:canResetAgentView');
        // Reload button should be visible without requiring an agent to be selected
        expect(refreshAgentsCommand?.when).not.toContain('agentforceDX:agentSelected');
      });

      it('should have export conversation command visible only when history is present', () => {
        const exportCommand = viewTitleMenus.find(
          (menu: any) => menu.command === 'sf.agent.combined.view.exportConversation'
        );

        expect(exportCommand).toBeDefined();
        expect(exportCommand?.when).toContain('agentforceDX:agentSelected');
        expect(exportCommand?.when).toContain('!agentforceDX:sessionStarting');
        expect(exportCommand?.when).toContain('!agentforceDX:sessionError');
        expect(exportCommand?.when).toContain('agentforceDX:hasConversationData');
      });

      it('should show reset agent view command only when reset is available', () => {
        const resetCommand = viewTitleMenus.find(
          (menu: any) => menu.command === 'sf.agent.combined.view.resetAgentView'
        );

        expect(resetCommand).toBeDefined();
        expect(resetCommand?.when).toContain('agentforceDX:canResetAgentView');
        expect(resetCommand?.when).toContain('agentforceDX:agentSelected');
      });

      it('should ensure restart and refresh agent commands are mutually exclusive', () => {
        const restartCommand = viewTitleMenus.find((menu: any) => menu.command === 'sf.agent.combined.view.refresh');
        const refreshAgentsCommand = viewTitleMenus.find(
          (menu: any) => menu.command === 'sf.agent.combined.view.refreshAgents'
        );

        expect(restartCommand).toBeDefined();
        expect(refreshAgentsCommand).toBeDefined();

        // Restart should only show when session is active
        expect(restartCommand?.when).toContain('agentforceDX:sessionActive');

        // Refresh agents should only show when session is NOT active
        expect(refreshAgentsCommand?.when).toContain('!agentforceDX:sessionActive');

        // They should be mutually exclusive
        const restartWhen = restartCommand?.when;
        const refreshWhen = refreshAgentsCommand?.when;

        // If sessionActive is true, restart shows (contains sessionActive)
        // If sessionActive is false, refresh shows (contains !sessionActive)
        expect(restartWhen?.includes('agentforceDX:sessionActive')).toBe(true);
        expect(refreshWhen?.includes('!agentforceDX:sessionActive')).toBe(true);
      });
    });

    describe('command definitions', () => {
      const commands = packageJson.contributes.commands;

      it('should have restart agent command defined', () => {
        const restartCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.refresh');

        expect(restartCommand).toBeDefined();
        expect(restartCommand?.title).toBe('Restart Agent');
        expect(restartCommand?.icon).toBe('$(debug-rerun)');
      });

      it('should have refresh agents command defined', () => {
        const refreshCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.refreshAgents');

        expect(refreshCommand).toBeDefined();
        expect(refreshCommand?.title).toBe('Refresh Agent List');
        expect(refreshCommand?.icon).toBe('$(refresh)');
      });

      it('should define the export conversation command', () => {
        const exportCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.exportConversation');

        expect(exportCommand).toBeDefined();
        expect(exportCommand?.title).toBe('Download Conversation');
        expect(exportCommand?.icon).toBe('$(arrow-circle-down)');
      });

      it('should define the reset agent view command', () => {
        const resetCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.resetAgentView');

        expect(resetCommand).toBeDefined();
        expect(resetCommand?.title).toBe('Reset Agent View');
        expect(resetCommand?.icon).toBe('$(clear-all)');
      });

      it('should have focus view alias commands defined', () => {
        const focusViewCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.focusView');
        const focusTestViewCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.focusTestView');

        expect(focusViewCommand).toBeDefined();
        expect(focusViewCommand?.title).toBe('AFDX: Focus on Agentforce DX View');

        expect(focusTestViewCommand).toBeDefined();
        expect(focusTestViewCommand?.title).toBe('AFDX: Focus on Agent Tests View');
      });

      it('should have start agent command defined with proper enablement', () => {
        const startAgentCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.startAgent');

        expect(startAgentCommand).toBeDefined();
        expect(startAgentCommand?.title).toBe('Start Agent');
        expect(startAgentCommand?.enablement).toContain('!agentforceDX:sessionActive');
        expect(startAgentCommand?.enablement).toContain('!agentforceDX:sessionStarting');
      });

      it('should have select agent command defined', () => {
        const selectAgentCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.selectAndRun');

        expect(selectAgentCommand).toBeDefined();
        expect(selectAgentCommand?.title).toBe('Select Agent');
      });

      it('should have debug commands with proper enablement', () => {
        const startDebugCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.debug');
        const stopDebugCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.debugStop');

        expect(startDebugCommand).toBeDefined();
        expect(startDebugCommand?.title).toBe('Start Debug Mode');
        expect(startDebugCommand?.enablement).toContain('!agentforceDX:debugMode');

        expect(stopDebugCommand).toBeDefined();
        expect(stopDebugCommand?.title).toBe('Stop Debug Mode');
        expect(stopDebugCommand?.enablement).toBe('agentforceDX:debugMode');
      });

      it('should ensure start and restart commands are mutually exclusive', () => {
        const startCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.startAgent');
        const restartCommand = commands.find((cmd: any) => cmd.command === 'sf.agent.combined.view.refresh');

        expect(startCommand).toBeDefined();
        expect(restartCommand).toBeDefined();

        // Start should only be enabled when session is NOT active
        expect(startCommand?.enablement).toContain('!agentforceDX:sessionActive');

        // Restart should only be enabled when session IS active
        expect(restartCommand?.enablement).toContain('agentforceDX:sessionActive');
      });
    });
  });
});
