/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { AgentTestGroupNode, AgentTestNode } from '../../src/types';
import { AgentTestOutlineProvider, getTestOutlineProvider } from '../../src/views/testOutlineProvider';
import { Commands } from '../../src/enums/commands';

describe('AgentTestOutlineProvider', () => {
  let provider: AgentTestOutlineProvider;

  beforeEach(() => {
    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue({
      extensionUri: { fsPath: '/fake/path/to/extension' }
    } as any);
    provider = new AgentTestOutlineProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getChildren should return children of a given node', () => {
    const parentNode = new AgentTestGroupNode('Parent');
    const childNode = new AgentTestNode('Child');
    parentNode.children.push(childNode);
    expect(provider.getChildren(parentNode)).toEqual([childNode]);
  });

  it('getChildren should return default message when no tests exist', () => {
    const result = provider.getChildren();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('no tests found');
  });

  it('refresh should reload tests', async () => {
    const parseSpy = jest.spyOn(provider, 'refreshView').mockImplementation();
    const parseAgentSpy = jest
      .spyOn(require('../../src/views/testOutlineProvider'), 'parseAgentTestsFromProject')
      .mockResolvedValue(new Map());

    await provider.refresh();

    expect(parseSpy).toHaveBeenCalled();
    expect(parseAgentSpy).toHaveBeenCalled();
  });

  it('collapseAll should call VSCode command', async () => {
    const commandSpy = jest.spyOn(vscode.commands, 'executeCommand');
    await provider.collapseAll();
    expect(commandSpy.mock.calls.length).toBe(1);
    expect(commandSpy).toHaveBeenCalledWith(`workbench.actions.treeView.${Commands.collapseAll}`);
  });

  test('getTestOutlineProvider should return a singleton instance', () => {
    const instance1 = getTestOutlineProvider();
    const instance2 = getTestOutlineProvider();
    expect(instance1).toBe(instance2);
  });
});
