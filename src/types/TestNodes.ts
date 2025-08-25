import * as vscode from 'vscode';
import { TestStatus } from '@salesforce/agents';
import { getTestOutlineProvider } from '../views/testOutlineProvider';

/**
 * Abstract, meant for functionality that will affect all levels of nodes (top, sub)
 */
export abstract class TestNode extends vscode.TreeItem {
  public children = new Array<TestNode>();
  public parentName = '';

  protected resourceDir = vscode.Uri.joinPath(
    vscode.extensions.getExtension('salesforce.salesforcedx-vscode-agents')!.extensionUri,
    'resources'
  );
  public iconPath = {
    light: vscode.Uri.joinPath(this.resourceDir, 'light', 'testNotRun.svg'),
    dark: vscode.Uri.joinPath(this.resourceDir, 'dark', 'testNotRun.svg')
  };

  protected constructor(
    public name: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public location: vscode.Location | null
  ) {
    super(name, collapsibleState);
    this.command = {
      command: `sf.agent.test.view.goToTestResults`,
      title: 'SHOW ERROR',
      arguments: [this]
    };
  }

  public abstract contextValue: string;

  public updateOutcome(outcome: TestStatus): void {
    switch (outcome) {
      case 'COMPLETED': // Passed Test
        this.iconPath = {
          light: vscode.Uri.joinPath(this.resourceDir, 'light', 'testPass.svg'),
          dark: vscode.Uri.joinPath(this.resourceDir, 'dark', 'testPass.svg')
        };
        break;
      case 'TERMINATED':
      case 'ERROR':
        this.iconPath = {
          light: vscode.Uri.joinPath(this.resourceDir, 'light', 'testFail.svg'),
          dark: vscode.Uri.joinPath(this.resourceDir, 'dark', 'testFail.svg')
        };
        break;
      case 'NEW':
      case 'IN_PROGRESS':
        this.iconPath = {
          light: vscode.Uri.joinPath(this.resourceDir, 'light', 'testInProgress.svg'),
          dark: vscode.Uri.joinPath(this.resourceDir, 'dark', 'testInProgress.svg')
        };
        break;
    }
    // refreshes the icon to the new one
    getTestOutlineProvider().refreshView();
  }
}

/**
 * Top level test container, this is a runnable agent test
 * has children AgentTestNode for individual test cases
 */
export class AgentTestGroupNode extends TestNode {
  constructor(label: string, location?: vscode.Location) {
    super(label, vscode.TreeItemCollapsibleState.Expanded, location ?? null);
  }

  public contextValue = 'agentTestGroup';

  public updateOutcome(outcome: TestStatus, applyToChildren?: boolean): void {
    super.updateOutcome(outcome);
    if (applyToChildren) {
      this.children.forEach(child => {
        child.updateOutcome(outcome);
      });
    }
  }

  public getChildren(): TestNode[] {
    return this.children;
  }
}

/**
 * child test cases, not individually runnable
 */
export class AgentTestNode extends TestNode {
  constructor(label: string, location?: vscode.Location) {
    super(label, vscode.TreeItemCollapsibleState.None, location ?? null);
  }
  public contextValue = 'agentTest';
}
