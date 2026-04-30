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
import { EOL } from 'os';
import { basename } from 'path';
import * as vscode from 'vscode';
import * as xml from 'fast-xml-parser';
import { Commands } from '../enums/commands';
import { AgentTestGroupNode, AgentTestNode, AiEvaluationDefinition, AiTestingDefinition, TestNode } from '../types';
import type { TestRunnerType } from '@salesforce/agents';

const NO_TESTS_MESSAGE = 'no tests found';
const NO_TESTS_DESCRIPTION = 'no test description';
const AGENT_TESTS = 'AgentTests';

const buildTestGroupNode = (
  definitionUri: vscode.Uri,
  definitionApiName: string,
  label: string,
  runnerType: TestRunnerType,
  testCases: Array<{ number: string; inputs: { utterance: string } }>,
  fileContent: string
): AgentTestGroupNode => {
  const testDefinitionNode = new AgentTestGroupNode(
    label,
    new vscode.Location(definitionUri, new vscode.Position(0, 0))
  );
  testDefinitionNode.testDefinitionName = definitionApiName;
  testDefinitionNode.runnerType = runnerType;
  const splitContent = fileContent.split(EOL);
  testCases.map(test => {
    const line = splitContent.findIndex(l => l.includes(`<number>${test.number}</number`));
    const testcaseNode = new AgentTestNode(
      `#${test.number}`,
      new vscode.Location(definitionUri, new vscode.Position(line, 8))
    );
    testcaseNode.parentName = label;
    testcaseNode.description = test.inputs.utterance;
    testDefinitionNode.children.push(testcaseNode);
  });
  testDefinitionNode.children.sort((a, b) => a.name.localeCompare(b.name));
  return testDefinitionNode;
};

export const parseAgentTestsFromProject = async (): Promise<Map<string, AgentTestGroupNode>> => {
  const [aiEvalDefs, aiTestingDefs] = await Promise.all([
    vscode.workspace.findFiles('**/*.aiEvaluationDefinition-meta.xml'),
    vscode.workspace.findFiles('**/*.aiTestingDefinition-meta.xml')
  ]);
  const parser = new xml.XMLParser();

  // Parse both sets independently, keyed by API name
  const evalNodes = new Map<string, AgentTestGroupNode>();
  const agentforceStudioNodes = new Map<string, AgentTestGroupNode>();

  await Promise.all([
    ...aiEvalDefs.map(async definition => {
      const fileContent = (await vscode.workspace.fs.readFile(definition)).toString();
      const testDefinition = parser.parse(fileContent) as AiEvaluationDefinition;
      const definitionApiName = basename(definition.fsPath, '.aiEvaluationDefinition-meta.xml');
      const testCases = Array.isArray(testDefinition.AiEvaluationDefinition.testCase)
        ? testDefinition.AiEvaluationDefinition.testCase
        : [testDefinition.AiEvaluationDefinition.testCase];
      evalNodes.set(
        definitionApiName,
        buildTestGroupNode(definition, definitionApiName, definitionApiName, 'testing-center', testCases, fileContent)
      );
    }),
    ...aiTestingDefs.map(async definition => {
      const fileContent = (await vscode.workspace.fs.readFile(definition)).toString();
      const testDefinition = parser.parse(fileContent) as AiTestingDefinition;
      const definitionApiName = basename(definition.fsPath, '.aiTestingDefinition-meta.xml');
      const testCases = Array.isArray(testDefinition.AiTestingDefinition.testCase)
        ? testDefinition.AiTestingDefinition.testCase
        : [testDefinition.AiTestingDefinition.testCase];
      agentforceStudioNodes.set(
        definitionApiName,
        buildTestGroupNode(
          definition,
          definitionApiName,
          definitionApiName,
          'agentforce-studio',
          testCases,
          fileContent
        )
      );
    })
  ]);

  // Apply disambiguation labels for names that appear in both sets
  const conflicts = new Set([...evalNodes.keys()].filter(k => agentforceStudioNodes.has(k)));
  for (const name of conflicts) {
    const evalNode = evalNodes.get(name)!;
    const afsNode = agentforceStudioNodes.get(name)!;
    const evalLabel = `${name} (testing-center)`;
    const afsLabel = `${name} (agentforce-studio)`;
    evalNode.label = evalLabel;
    evalNode.name = evalLabel;
    evalNode.children.forEach(c => (c.parentName = evalLabel));
    afsNode.label = afsLabel;
    afsNode.name = afsLabel;
    afsNode.children.forEach(c => (c.parentName = afsLabel));
  }

  // Merge into a single map keyed by the (possibly suffixed) label
  const aggregator = new Map<string, AgentTestGroupNode>();
  for (const node of [...evalNodes.values(), ...agentforceStudioNodes.values()]) {
    aggregator.set(node.name, node);
  }

  return aggregator;
};

export class AgentTestOutlineProvider implements vscode.TreeDataProvider<TestNode> {
  // communicates to VSC that the data has changed and needs to be rerendered - these are vitally important
  private onDidChangeTestData = new vscode.EventEmitter<TestNode | undefined>();
  public onDidChangeTreeData = this.onDidChangeTestData.event;

  // matches from definition name -> definition tree object, with children test cases
  private agentTestMap = new Map<string, AgentTestGroupNode>();
  private rootNode: TestNode | null;

  constructor() {
    this.rootNode = new AgentTestGroupNode(AGENT_TESTS);
  }

  public getTestGroup(key: string): AgentTestGroupNode | undefined {
    return this.agentTestMap.get(key);
  }

  public refreshView(): void {
    this.onDidChangeTestData.fire(undefined);
  }

  public getChildren(element?: TestNode): TestNode[] {
    if (element) {
      return element.children;
    } else {
      if (this.rootNode && this.rootNode.children.length > 0) {
        return this.rootNode.children;
      } else {
        const testToDisplay = new AgentTestNode(NO_TESTS_MESSAGE);
        testToDisplay.description = NO_TESTS_DESCRIPTION;
        return [testToDisplay];
      }
    }
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      if (!(this.rootNode && this.rootNode.children.length > 0)) {
        this.rootNode = new AgentTestGroupNode(NO_TESTS_MESSAGE);
        const testToDisplay = new AgentTestNode(NO_TESTS_MESSAGE);
        testToDisplay.description = NO_TESTS_DESCRIPTION;
        this.rootNode.children.push(testToDisplay);
      }
      return this.rootNode;
    }
  }

  public async refresh(): Promise<void> {
    this.rootNode = new AgentTestGroupNode(AGENT_TESTS);
    this.agentTestMap.clear();
    this.agentTestMap = await parseAgentTestsFromProject();

    // Sort test groups alphabetically by name
    const sortedTestGroups = Array.from(this.agentTestMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    this.rootNode.children.push(...sortedTestGroups);
    this.refreshView();
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.${Commands.collapseAll}`);
  }
}

let testOutlineProviderInst: AgentTestOutlineProvider;

export const getTestOutlineProvider = () => {
  if (!testOutlineProviderInst) {
    testOutlineProviderInst = new AgentTestOutlineProvider();
  }
  return testOutlineProviderInst;
};
