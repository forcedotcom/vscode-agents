/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */ 1;
import { EOL } from 'os';
import { basename } from 'path';
import * as vscode from 'vscode';
import * as xml from 'fast-xml-parser';
import { Commands } from '../enums/commands';
import { AgentTestGroupNode, AgentTestNode, AiEvaluationDefinition, TestNode } from '../types';

const NO_TESTS_MESSAGE = 'no tests found';
const NO_TESTS_DESCRIPTION = 'no test description';
const AGENT_TESTS = 'AgentTests';
export const parseAgentTestsFromProject = async (): Promise<Map<string, AgentTestGroupNode>> => {
  const aiTestDefs = await vscode.workspace.findFiles('**/*.aiEvaluationDefinition-meta.xml');
  //from the aiTestDef files, parse the xml using fast-xml-parser, find the testSetName that it points to
  const aggregator = new Map<string, AgentTestGroupNode>();
  const parser = new xml.XMLParser();
  await Promise.all(
    aiTestDefs.map(async definition => {
      const fileContent = (await vscode.workspace.fs.readFile(definition)).toString();
      const testDefinition = parser.parse(fileContent) as AiEvaluationDefinition;
      const definitionApiName = basename(definition.fsPath, '.aiEvaluationDefinition-meta.xml');

      const testDefinitionNode = new AgentTestGroupNode(
        definitionApiName,
        new vscode.Location(definition, new vscode.Position(0, 0))
      );

      const splitContent = fileContent.split(EOL);

      testDefinition.AiEvaluationDefinition.testCase.map(test => {
        const line = splitContent.findIndex(l => l.includes(`<number>${test.number}</number`));
        const testcaseNode = new AgentTestNode(
          `#${test.number}`,
          new vscode.Location(definition, new vscode.Position(line, 8))
        );
        testcaseNode.parentName = definitionApiName;
        testcaseNode.description = test.inputs.utterance;
        testDefinitionNode.children.push(testcaseNode);
      });

      aggregator.set(testDefinitionNode.name, testDefinitionNode);
    })
  );

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
    this.rootNode.children.push(...Array.from(this.agentTestMap.values()));
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
