#! /usr/bin/env node
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
import * as shell from 'shelljs';
type WorkflowRun = {
  databaseId: string;
};
const EXTENSION_ID = 'salesforce.salesforcedx-vscode-agents';
const SAVE_DIRECTORY = './.localTesting/';
const IDE = process.argv[2] as string;

const logger = (msg: string, obj?: unknown) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

logger('==========================');
logger('Hello easier VSIX testing!');
logger('==========================\n');

if (shell.test('-e', SAVE_DIRECTORY)) {
  logger(`Deleting previous VSIX files. \n`);
  shell.rm('-rf', SAVE_DIRECTORY);
}

logger('The branch that you are testing with is: ');
const currentBranch = shell.exec(`git branch --show-current`);
logger('\n');

logger('Getting the latest successful Commit Workflow for this run');
const latestWorkflowForBranch = shell
  .exec(`gh run list -e push -s success -L 1  --json databaseId -b ${currentBranch}`)
  .toString()
  .trim();
logger('\n');

if (latestWorkflowForBranch === '[]') {
  logger('No successful workflow runs found for this branch. Exiting.');
  process.exit(0);
}

const ghJobRun: WorkflowRun = JSON.parse(latestWorkflowForBranch.toString())[0];

logger(`Saving the resources for job ID ${ghJobRun.databaseId} \n`);
shell.exec(`gh run download ${ghJobRun.databaseId} --dir ${SAVE_DIRECTORY}`);

const agentsPath = shell.find(SAVE_DIRECTORY).filter(function (file) {
  return file.includes('agents');
});

if (agentsPath) {
  logger('Cleaning up any old GPT versions (if applicable) and installing the new VSIX.');
  shell.exec(`${IDE} --uninstall-extension ${EXTENSION_ID}`);
  shell.exec(`${IDE} --install-extension ${agentsPath}`);
  logger(`Done! Agents VSIX was installed in ${IDE}. Reload VS Code and start your testing.`);
} else {
  logger(`No VSIX for Agents could be installed from your ${SAVE_DIRECTORY}.`);
}
