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
import { TestStatus } from '@salesforce/agents';

// Mock getTestOutlineProvider
jest.mock('../../src/views/testOutlineProvider', () => ({
  getTestOutlineProvider: jest.fn(() => ({
    refreshView: jest.fn()
  }))
}));

describe('TestNodes', () => {
  beforeEach(() => {
    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue({
      extensionUri: { fsPath: '/fake/path/to/extension' }
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AgentTestGroupNode', () => {
    it('should create a test group node with a label', () => {
      const node = new AgentTestGroupNode('TestGroup');
      expect(node.name).toBe('TestGroup');
      expect(node.contextValue).toBe('agentTestGroup');
    });

    it('should create a test group node with a label and location', () => {
      const location = new vscode.Location(
        { fsPath: '/test/file.ts' } as vscode.Uri,
        new vscode.Position(0, 0)
      ) as any;
      const node = new AgentTestGroupNode('TestGroup', location);
      expect(node.name).toBe('TestGroup');
      expect(node.location).toBe(location);
    });

    it('should update outcome to COMPLETED with pass icon', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('COMPLETED' as TestStatus);

      expect(node.iconPath).toHaveProperty('light');
      expect(node.iconPath).toHaveProperty('dark');
      expect((node.iconPath as any).light.path).toContain('testPass.svg');
      expect((node.iconPath as any).dark.path).toContain('testPass.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });

    it('should update outcome to ERROR with fail icon', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('ERROR' as TestStatus);

      expect(node.iconPath).toHaveProperty('light');
      expect(node.iconPath).toHaveProperty('dark');
      expect((node.iconPath as any).light.path).toContain('testFail.svg');
      expect((node.iconPath as any).dark.path).toContain('testFail.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });

    it('should update outcome to TERMINATED with fail icon', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('TERMINATED' as TestStatus);

      expect(node.iconPath).toHaveProperty('light');
      expect(node.iconPath).toHaveProperty('dark');
      expect((node.iconPath as any).light.path).toContain('testFail.svg');
      expect((node.iconPath as any).dark.path).toContain('testFail.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });

    it('should update outcome to IN_PROGRESS with in-progress icon', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('IN_PROGRESS' as TestStatus);

      expect(node.iconPath).toHaveProperty('light');
      expect(node.iconPath).toHaveProperty('dark');
      expect((node.iconPath as any).light.path).toContain('testInProgress.svg');
      expect((node.iconPath as any).dark.path).toContain('testInProgress.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });

    it('should update outcome to NEW with in-progress icon', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('NEW' as TestStatus);

      expect(node.iconPath).toHaveProperty('light');
      expect(node.iconPath).toHaveProperty('dark');
      expect((node.iconPath as any).light.path).toContain('testInProgress.svg');
      expect((node.iconPath as any).dark.path).toContain('testInProgress.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });

    it('should update outcome and apply to children when applyToChildren is true', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const child1 = new AgentTestNode('Child1');
      const child2 = new AgentTestNode('Child2');
      node.children.push(child1, child2);

      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('COMPLETED' as TestStatus, true);

      expect((node.iconPath as any).light.path).toContain('testPass.svg');
      expect((child1.iconPath as any).light.path).toContain('testPass.svg');
      expect((child2.iconPath as any).light.path).toContain('testPass.svg');
      expect(mockRefreshView).toHaveBeenCalledTimes(3); // Once for parent, once for each child
    });

    it('should update outcome without applying to children when applyToChildren is false', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const child1 = new AgentTestNode('Child1');
      const child2 = new AgentTestNode('Child2');
      node.children.push(child1, child2);

      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('COMPLETED' as TestStatus, false);

      expect((node.iconPath as any).light.path).toContain('testPass.svg');
      expect((child1.iconPath as any).light.path).toContain('testNotRun.svg');
      expect((child2.iconPath as any).light.path).toContain('testNotRun.svg');
      expect(mockRefreshView).toHaveBeenCalledTimes(1); // Only for parent
    });

    it('should return children via getChildren method', () => {
      const node = new AgentTestGroupNode('TestGroup');
      const child1 = new AgentTestNode('Child1');
      const child2 = new AgentTestNode('Child2');
      node.children.push(child1, child2);

      const children = node.getChildren();
      expect(children.length).toBe(2);
      expect(children[0]).toBe(child1);
      expect(children[1]).toBe(child2);
    });
  });

  describe('AgentTestNode', () => {
    it('should create a test node with a label', () => {
      const node = new AgentTestNode('TestCase');
      expect(node.name).toBe('TestCase');
      expect(node.contextValue).toBe('agentTest');
    });

    it('should create a test node with a label and location', () => {
      const location = new vscode.Location(
        { fsPath: '/test/file.ts' } as vscode.Uri,
        new vscode.Position(5, 10)
      ) as any;
      const node = new AgentTestNode('TestCase', location);
      expect(node.name).toBe('TestCase');
      expect(node.location).toBe(location);
    });

    it('should update outcome to COMPLETED with pass icon', () => {
      const node = new AgentTestNode('TestCase');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('COMPLETED' as TestStatus);

      expect((node.iconPath as any).light.path).toContain('testPass.svg');
      expect((node.iconPath as any).dark.path).toContain('testPass.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });

    it('should update outcome to ERROR with fail icon', () => {
      const node = new AgentTestNode('TestCase');
      const { getTestOutlineProvider } = require('../../src/views/testOutlineProvider');
      const mockRefreshView = jest.fn();
      getTestOutlineProvider.mockReturnValue({ refreshView: mockRefreshView });

      node.updateOutcome('ERROR' as TestStatus);

      expect((node.iconPath as any).light.path).toContain('testFail.svg');
      expect((node.iconPath as any).dark.path).toContain('testFail.svg');
      expect(mockRefreshView).toHaveBeenCalled();
    });
  });
});
