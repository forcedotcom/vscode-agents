/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import { Event } from 'vscode';
import { Connection } from '@salesforce/core';

export interface WorkspaceContext {
  readonly onOrgChange: Event<{
    username?: string;
    alias?: string;
  }>;
  getInstance(forceNew: boolean): WorkspaceContext;
  getConnection(): Promise<Connection>;
  username(): string | undefined;
  alias(): string | undefined;
}
