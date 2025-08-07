/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { AgentTestOutlineProvider } from './testOutlineProvider';
import {
  AgentTester,
  TestStatus,
  AgentTestResultsResponse,
  humanFriendlyName,
  metric
} from '@salesforce/agents-bundle';
import { Lifecycle } from '@salesforce/core-bundle';
import { Duration } from '@salesforce/kit';
import type { AgentTestGroupNode, TestNode } from '../types';
import { CoreExtensionService } from '../services/coreExtensionService';
import { AgentTestNode } from '../types';

export class AgentTestRunner {
  private testGroupNameToResult = new Map<string, AgentTestResultsResponse>();
  constructor(private testOutline: AgentTestOutlineProvider) {}

  public displayTestDetails(test: TestNode) {
    const channelService = CoreExtensionService.getChannelService();
    channelService.showChannelOutput();
    channelService.clear();

    const resultFromMap = this.testGroupNameToResult.get(test.name) ?? this.testGroupNameToResult.get(test.parentName);
    if (!resultFromMap) {
      vscode.window.showErrorMessage('You need to run the test first to see its results.');
      return;
    }
    // set to a new var so we can remove test cases and not affect saved information
    const testInfo = structuredClone(resultFromMap);
    if (test instanceof AgentTestNode) {
      // filter to selected test case
      testInfo.testCases = testInfo.testCases.filter(f => `#${f.testNumber}` === test.name);
    }
    testInfo.testCases.map(tc => {
      channelService.appendLine('════════════════════════════════════════════════════════════════════════');
      channelService.appendLine(`CASE #${tc.testNumber} - ${testInfo.subjectName}`);
      channelService.appendLine('════════════════════════════════════════════════════════════════════════');
      channelService.appendLine('');
      channelService.appendLine(`"${tc.inputs.utterance}"`);
      channelService.appendLine('');
      tc.testResults
        // this is the output for topics/action/output validation (actual v expected)
        // filter out other metrics from it
        .filter(f => !metric.includes(f.name as (typeof metric)[number]))
        .map(tr => {
          channelService.appendLine(
            `❯ ${humanFriendlyName(tr.name).toUpperCase()}: ${tr.result} ${tr.result === 'PASS' ? '✅' : '❌'}`
          );
          channelService.appendLine('────────────────────────────────────────────────────────────────────────');
          channelService.appendLine(`EXPECTED : ${tr.expectedValue.replaceAll('\n', '')}`);
          channelService.appendLine(`ACTUAL   : ${tr.actualValue.replaceAll('\n', '')}`);
          channelService.appendLine(`SCORE    : ${tr.score}`);
          channelService.appendLine('');
        });

      const metricResults = tc.testResults
        // this is the output for metric information
        // filter out the standard evaluations (topics/action/output)
        .filter(f => metric.includes(f.name as (typeof metric)[number]));
      if (metricResults.length > 0) {
        channelService.appendLine(`❯ METRICS (Value/Threshold)`);
        channelService.appendLine('────────────────────────────────────────────────────────────────────────');
        metricResults.map(tr => {
          if (tr.name === 'output_latency_milliseconds') {
            channelService.appendLine(
              `⏱️ : ${humanFriendlyName(tr.name).toUpperCase()} (${tr.score}ms)  ${tr.metricExplainability ? `: ${tr.metricExplainability}` : ''}`
            );
          } else {
            channelService.appendLine(
              // 0.6 is the threshold for passing, hardcoded for now
              `${tr.result === 'PASS' ? '✅' : '❌'} : ${humanFriendlyName(tr.name).toUpperCase()} (${tr.score}/0.6) ${tr.metricExplainability ? `: ${tr.metricExplainability}` : ''}`
            );
          }
        });
      }

      channelService.appendLine('');
      channelService.appendLine('────────────────────────────────────────────────────────────────────────');
      channelService.appendLine(
        `TEST CASE SUMMARY: ${tc.testResults.length} tests run | ✅ ${tc.testResults.filter(tc => tc.result === 'PASS').length} passed | ❌ ${tc.testResults.filter(tc => tc.result === 'FAILURE').length} failed`
      );
    });
  }

  public async runAgentTest(test: AgentTestGroupNode) {
    const channelService = CoreExtensionService.getChannelService();
    const telemetryService = CoreExtensionService.getTelemetryService();
    telemetryService.sendCommandEvent('RunAgentTest');
    try {
      let passing,
        failing,
        total = 0;
      const lifecycle = await Lifecycle.getInstance();
      channelService.clear();
      channelService.showChannelOutput();
      const tester = new AgentTester(await CoreExtensionService.getDefaultConnection());
      channelService.appendLine(`Starting ${test.name} tests: ${new Date().toLocaleString()}`);
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Running ${test.name}`
        },
        async progress => {
          return new Promise((resolve, reject) => {
            lifecycle.on(
              'AGENT_TEST_POLLING_EVENT',
              async (data: {
                status: TestStatus;
                completedTestCases: number;
                totalTestCases: number;
                failingTestCases: number;
                passingTestCases: number;
              }) => {
                switch (data.status) {
                  case 'NEW':
                  case 'IN_PROGRESS':
                    // every time IN_PROGRESS is returned, 10 is added, is possible to 100% progress bar and tests not be done
                    progress.report({ increment: 10, message: `Status: In Progress` });
                    break;
                  case 'ERROR':
                  case 'TERMINATED':
                    passing = data.passingTestCases;
                    failing = data.failingTestCases;
                    total = data.totalTestCases;
                    progress.report({ increment: 100, message: `Status: ${data.status}` });
                    setTimeout(() => reject(), 1500);
                    break;
                  case 'COMPLETED':
                    passing = data.passingTestCases;
                    failing = data.failingTestCases;
                    total = data.totalTestCases;
                    progress.report({ increment: 100, message: `Status: ${data.status}` });
                    setTimeout(() => resolve({}), 1500);
                    break;
                }
              }
            );
          });
        }
      );

      const response = await tester.start(test.name);
      // begin in-progress
      this.testOutline.getTestGroup(test.name)?.updateOutcome('IN_PROGRESS', true);
      channelService.appendLine(`Job Id: ${response.runId}`);

      const result = await tester.poll(response.runId, { timeout: Duration.minutes(100) });
      this.testGroupNameToResult.set(test.name, result);
      this.testOutline.getTestGroup(test.name)?.updateOutcome('IN_PROGRESS', true);
      let hasFailure = false;
      result.testCases.map(tc => {
        hasFailure = tc.testResults.some(tr => tr.result === 'FAILURE');

        // update the children, accordingly if they passed/failed
        this.testOutline
          .getTestGroup(test.name)
          ?.getChildren()
          .find(child => child.name === `#${tc.testNumber}`)
          ?.updateOutcome(hasFailure ? 'ERROR' : 'COMPLETED');
      });
      // update the parent's icon
      this.testOutline.getTestGroup(test.name)?.updateOutcome(hasFailure ? 'ERROR' : 'COMPLETED');
      channelService.appendLine(result.status);
      channelService.appendLine('');
      channelService.appendLine('Test Results');
      channelService.appendLine(`Passing: ${passing}/${total}`);
      channelService.appendLine(`Failing: ${failing}/${total}`);
      channelService.appendLine('');
      channelService.appendLine(`Select a test case in the Test View panel for more information`);
    } catch (e) {
      const error = e as Error;
      void Lifecycle.getInstance().emit('AGENT_TEST_POLLING_EVENT', { status: 'ERROR' });
      this.testOutline.getTestGroup(test.name)?.updateOutcome('ERROR', true);
      channelService.appendLine(`Error running test: ${error.message}`);
      telemetryService.sendException(error.name, error.message);
    }
  }
}
