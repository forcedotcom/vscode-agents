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

import * as vscode from 'vscode';
import { AgentTestGroupNode, AgentTestNode } from '../../src/types';
import { AgentTestOutlineProvider, getTestOutlineProvider, parseAgentTestsFromProject } from '../../src/views/testOutlineProvider';
import { Commands } from '../../src/enums/commands';
import { EOL } from 'os';

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

  it('getTestGroup should return test group by key', async () => {
    const testGroupNode = new AgentTestGroupNode('TestGroup1');
    const mockMap = new Map<string, AgentTestGroupNode>();
    mockMap.set('TestGroup1', testGroupNode);

    jest
      .spyOn(require('../../src/views/testOutlineProvider'), 'parseAgentTestsFromProject')
      .mockResolvedValue(mockMap);

    await provider.refresh();

    const result = provider.getTestGroup('TestGroup1');
    expect(result).toBe(testGroupNode);
    expect(result?.name).toBe('TestGroup1');
  });

  it('getTestGroup should return undefined for non-existent key', async () => {
    const mockMap = new Map<string, AgentTestGroupNode>();
    jest
      .spyOn(require('../../src/views/testOutlineProvider'), 'parseAgentTestsFromProject')
      .mockResolvedValue(mockMap);

    await provider.refresh();

    const result = provider.getTestGroup('NonExistent');
    expect(result).toBeUndefined();
  });

  it('refreshView should fire onDidChangeTreeData event', () => {
    const fireSpy = jest.spyOn((provider as any).onDidChangeTestData, 'fire');
    provider.refreshView();
    expect(fireSpy).toHaveBeenCalledWith(undefined);
  });

  it('getTreeItem should return element when provided', () => {
    const testNode = new AgentTestNode('TestNode');
    const result = provider.getTreeItem(testNode);
    expect(result).toBe(testNode);
  });

  it('getTreeItem should return root node with default message when no element and no children', () => {
    const result = provider.getTreeItem(undefined as any) as AgentTestGroupNode;
    expect(result.name).toBe('no tests found');
    expect(result.children.length).toBe(1);
    expect((result.children[0] as AgentTestNode).name).toBe('no tests found');
  });

  it('getChildren should return root children when rootNode has children', async () => {
    const testGroup = new AgentTestGroupNode('TestGroup1');
    const testNode = new AgentTestNode('Test1');
    testGroup.children.push(testNode);

    const mockMap = new Map<string, AgentTestGroupNode>();
    mockMap.set('TestGroup1', testGroup);

    jest
      .spyOn(require('../../src/views/testOutlineProvider'), 'parseAgentTestsFromProject')
      .mockResolvedValue(mockMap);

    await provider.refresh();

    const result = provider.getChildren();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toBe(testGroup);
  });

  it('refresh should sort test groups alphabetically', async () => {
    const testGroup1 = new AgentTestGroupNode('ZTest');
    const testGroup2 = new AgentTestGroupNode('ATest');
    const testGroup3 = new AgentTestGroupNode('MTest');

    const mockMap = new Map<string, AgentTestGroupNode>();
    mockMap.set('ZTest', testGroup1);
    mockMap.set('ATest', testGroup2);
    mockMap.set('MTest', testGroup3);

    jest
      .spyOn(require('../../src/views/testOutlineProvider'), 'parseAgentTestsFromProject')
      .mockResolvedValue(mockMap);

    await provider.refresh();

    const children = provider.getChildren();
    expect(children[0].name).toBe('ATest');
    expect(children[1].name).toBe('MTest');
    expect(children[2].name).toBe('ZTest');
  });

  it('refresh should clear existing test map before loading new tests', async () => {
    const testGroup1 = new AgentTestGroupNode('TestGroup1');
    const mockMap1 = new Map<string, AgentTestGroupNode>();
    mockMap1.set('TestGroup1', testGroup1);

    const testGroup2 = new AgentTestGroupNode('TestGroup2');
    const mockMap2 = new Map<string, AgentTestGroupNode>();
    mockMap2.set('TestGroup2', testGroup2);

    const parseAgentSpy = jest
      .spyOn(require('../../src/views/testOutlineProvider'), 'parseAgentTestsFromProject')
      .mockResolvedValueOnce(mockMap1)
      .mockResolvedValueOnce(mockMap2);

    await provider.refresh();
    expect(provider.getTestGroup('TestGroup1')).toBeDefined();

    await provider.refresh();
    expect(provider.getTestGroup('TestGroup1')).toBeUndefined();
    expect(provider.getTestGroup('TestGroup2')).toBeDefined();
  });
});

describe('parseAgentTestsFromProject', () => {
  beforeEach(() => {
    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue({
      extensionUri: { fsPath: '/fake/path/to/extension' }
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should parse single test case from XML file', async () => {
    const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    <testCase>
        <number>1</number>
        <inputs>
            <utterance>Test utterance 1</utterance>
        </inputs>
    </testCase>
</AiEvaluationDefinition>`;

    const mockUri = {
      fsPath: '/test/MyAgent.aiEvaluationDefinition-meta.xml'
    } as vscode.Uri;

    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([mockUri]);
    jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(Buffer.from(mockXmlContent));

    const result = await parseAgentTestsFromProject();

    expect(result.size).toBe(1);
    expect(result.has('MyAgent')).toBe(true);

    const testGroup = result.get('MyAgent');
    expect(testGroup).toBeDefined();
    expect(testGroup!.name).toBe('MyAgent');
    expect(testGroup!.children.length).toBe(1);
    expect(testGroup!.children[0].name).toBe('#1');
    expect((testGroup!.children[0] as any).description).toBe('Test utterance 1');
  });

  it('should parse multiple test cases from XML file', async () => {
    const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    <testCase>
        <number>2</number>
        <inputs>
            <utterance>Test utterance 2</utterance>
        </inputs>
    </testCase>
    <testCase>
        <number>1</number>
        <inputs>
            <utterance>Test utterance 1</utterance>
        </inputs>
    </testCase>
    <testCase>
        <number>3</number>
        <inputs>
            <utterance>Test utterance 3</utterance>
        </inputs>
    </testCase>
</AiEvaluationDefinition>`;

    const mockUri = {
      fsPath: '/test/MultiTestAgent.aiEvaluationDefinition-meta.xml'
    } as vscode.Uri;

    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([mockUri]);
    jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(Buffer.from(mockXmlContent));

    const result = await parseAgentTestsFromProject();

    expect(result.size).toBe(1);
    const testGroup = result.get('MultiTestAgent');
    expect(testGroup).toBeDefined();
    expect(testGroup!.children.length).toBe(3);

    // Verify sorting by name
    expect(testGroup!.children[0].name).toBe('#1');
    expect(testGroup!.children[1].name).toBe('#2');
    expect(testGroup!.children[2].name).toBe('#3');
  });

  it('should parse multiple XML files', async () => {
    const mockXmlContent1 = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    <testCase>
        <number>1</number>
        <inputs>
            <utterance>Agent1 test</utterance>
        </inputs>
    </testCase>
</AiEvaluationDefinition>`;

    const mockXmlContent2 = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    <testCase>
        <number>1</number>
        <inputs>
            <utterance>Agent2 test</utterance>
        </inputs>
    </testCase>
</AiEvaluationDefinition>`;

    const mockUri1 = {
      fsPath: '/test/Agent1.aiEvaluationDefinition-meta.xml'
    } as vscode.Uri;
    const mockUri2 = {
      fsPath: '/test/Agent2.aiEvaluationDefinition-meta.xml'
    } as vscode.Uri;

    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([mockUri1, mockUri2]);
    jest.spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValueOnce(Buffer.from(mockXmlContent1))
      .mockResolvedValueOnce(Buffer.from(mockXmlContent2));

    const result = await parseAgentTestsFromProject();

    expect(result.size).toBe(2);
    expect(result.has('Agent1')).toBe(true);
    expect(result.has('Agent2')).toBe(true);
  });

  it('should return empty map when no test files found', async () => {
    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([]);

    const result = await parseAgentTestsFromProject();

    expect(result.size).toBe(0);
  });

  it('should propagate read errors from workspace files', async () => {
    const mockUri = {
      fsPath: '/test/BrokenAgent.aiEvaluationDefinition-meta.xml'
    } as vscode.Uri;

    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([mockUri]);
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockRejectedValue(new Error('read failure'));

    await expect(parseAgentTestsFromProject()).rejects.toThrow('read failure');
  });

  it('should throw when XML is missing test cases', async () => {
    const mockUri = {
      fsPath: '/test/EmptyAgent.aiEvaluationDefinition-meta.xml'
    } as vscode.Uri;

    const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
</AiEvaluationDefinition>`;

    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([mockUri]);
    jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(Buffer.from(mockXmlContent));

    await expect(parseAgentTestsFromProject()).rejects.toThrow();
  });
});
