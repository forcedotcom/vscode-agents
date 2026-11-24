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

import { getAuthoringBundleRedirectUri, parseAuthoringBundleName } from '../../src/commands/agentUtils';

describe('parseAuthoringBundleName', () => {
  it.each([
    // versioned bundle folders (<DeveloperName>_<N>)
    ['Agent_Frank_3', 'Agent_Frank', 3],
    ['Agent_Frank_12', 'Agent_Frank', 12],
    ['Test01_1', 'Test01', 1],
    ['Agentforce_Service_Assistant_nhalko_2', 'Agentforce_Service_Assistant_nhalko', 2],
    // only the last _<digits> is the version, as on the platform
    ['Sales_2_1', 'Sales_2', 1],
    ['Agent10_2', 'Agent10', 2],
    ['ns__My_Agent_4', 'ns__My_Agent', 4],
    ['Agent_007', 'Agent', 7]
  ])('splits %s into %s version %d', (bundleName, projectName, projectVersionNumber) => {
    expect(parseAuthoringBundleName(bundleName)).toEqual({ projectName, projectVersionNumber });
  });

  it.each([
    // unversioned bundles (locally generated, or the newest version in a pre-API 64.0 retrieve)
    'Agent_Frank',
    'myBundle',
    'Willie_Resort_Manager',
    // trailing digits that aren't a _<N> suffix
    'Agent10',
    'Test01',
    'Agent_v2',
    'Agent_2a',
    'Agent_',
    '_3',
    // larger than the platform's Integer.parseInt accepts
    'Agent_99999999999'
  ])('keeps %s as the project name with no version', bundleName => {
    expect(parseAuthoringBundleName(bundleName)).toEqual({ projectName: bundleName });
  });
});

describe('getAuthoringBundleRedirectUri', () => {
  it('adds projectVersionNumber for a versioned bundle', () => {
    expect(getAuthoringBundleRedirectUri({ projectName: 'Agent_Frank', projectVersionNumber: 3 })).toBe(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Agent_Frank&projectVersionNumber=3'
    );
  });

  it('omits projectVersionNumber when there is no version', () => {
    expect(getAuthoringBundleRedirectUri({ projectName: 'Agent_Frank' })).toBe(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Agent_Frank'
    );
  });

  it('encodes the project name', () => {
    expect(getAuthoringBundleRedirectUri({ projectName: 'a&b=c' })).toBe(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=a%26b%3Dc'
    );
  });
});
