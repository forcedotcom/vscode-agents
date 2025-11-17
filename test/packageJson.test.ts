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
        const restartCommand = viewTitleMenus.find(
          (menu: any) => menu.command === 'sf.agent.combined.view.refresh'
        );

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
      });

      it('should ensure restart and refresh agent commands are mutually exclusive', () => {
        const restartCommand = viewTitleMenus.find(
          (menu: any) => menu.command === 'sf.agent.combined.view.refresh'
        );
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
        const restartCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.combined.view.refresh'
        );

        expect(restartCommand).toBeDefined();
        expect(restartCommand?.title).toBe('AFDX: Restart Agent');
        expect(restartCommand?.icon).toBe('$(debug-rerun)');
      });

      it('should have refresh agents command defined', () => {
        const refreshCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.combined.view.refreshAgents'
        );

        expect(refreshCommand).toBeDefined();
        expect(refreshCommand?.title).toBe('AFDX: Refresh Agent List');
      });

      it('should have focus view alias commands defined', () => {
        const focusViewCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.focusView'
        );
        const focusTestViewCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.focusTestView'
        );

        expect(focusViewCommand).toBeDefined();
        expect(focusViewCommand?.title).toBe('AFDX: Focus on Agentforce DX View');

        expect(focusTestViewCommand).toBeDefined();
        expect(focusTestViewCommand?.title).toBe('AFDX: Focus on Agent Tests View');
      });

      it('should have start agent command defined with proper enablement', () => {
        const startAgentCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.startAgent'
        );

        expect(startAgentCommand).toBeDefined();
        expect(startAgentCommand?.title).toBe('AFDX: Start Agent');
        expect(startAgentCommand?.enablement).toContain('!agentforceDX:sessionActive');
        expect(startAgentCommand?.enablement).toContain('!agentforceDX:sessionStarting');
      });

      it('should have select agent command defined', () => {
        const selectAgentCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.selectAndRun'
        );

        expect(selectAgentCommand).toBeDefined();
        expect(selectAgentCommand?.title).toBe('AFDX: Select Agent');
      });

      it('should have debug commands with proper enablement', () => {
        const startDebugCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.combined.view.debug'
        );
        const stopDebugCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.combined.view.debugStop'
        );

        expect(startDebugCommand).toBeDefined();
        expect(startDebugCommand?.title).toBe('AFDX: Start Debug Mode');
        expect(startDebugCommand?.enablement).toContain('!agentforceDX:debugMode');

        expect(stopDebugCommand).toBeDefined();
        expect(stopDebugCommand?.title).toBe('AFDX: Stop Debug Mode');
        expect(stopDebugCommand?.enablement).toBe('agentforceDX:debugMode');
      });

      it('should ensure start and restart commands are mutually exclusive', () => {
        const startCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.startAgent'
        );
        const restartCommand = commands.find(
          (cmd: any) => cmd.command === 'sf.agent.combined.view.refresh'
        );

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
