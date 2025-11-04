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
import '@testing-library/jest-dom';

// Mock the VSCode API that's available to webviews
const getMockWebviewApi = () => {
  return {
    postMessage: jest.fn(),
    getState: jest.fn(),
    setState: jest.fn()
  };
};

const mockWebApi = getMockWebviewApi();

// Mock the global function supplied to web views
(global as any).acquireVsCodeApi = () => mockWebApi;

// Reset the mock before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockWebApi.postMessage = jest.fn();
  mockWebApi.getState = jest.fn();
  mockWebApi.setState = jest.fn();
  (global as any).acquireVsCodeApi = () => mockWebApi;
});
