/**
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

import { createContext, ReactNode } from 'react';

export type VSCodeApiValue = {
  postMessage: (message: unknown) => void;
};

const vscode = acquireVsCodeApi();

export const VSCodeContext = createContext<VSCodeApiValue>({} as VSCodeApiValue);

export const WithVSCodeContext = ({ children }: { children: ReactNode }) => {
  return <VSCodeContext.Provider value={vscode}>{children}</VSCodeContext.Provider>;
};
