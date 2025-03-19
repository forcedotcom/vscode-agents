import React, { useEffect, useState } from 'react';
import ChatSession from './chatSession';
import { CssBaseline, Container } from '@mui/material';
import { SessionDetails } from './main';
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

const App: React.FC = () => {
  const [trace, setTrace] = useState<SessionDetails | undefined>(undefined);

  // on initialization
  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'initializeTrace' });
    } else {
      console.error('vscode API not available.');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', event => {
      const { command, data } = event.data;
      // eslint-disable-next-line no-console
      console.log('tracer app.tsx' + command + data);
      // const { command, data, error } = event.data;
      if (command === 'setTrace') {
        setTrace(data);
      }
    });
    return () => window.removeEventListener('message', () => {});
  }, []);

  return (
    <Container maxWidth="md">
      <CssBaseline />
      <ChatSession trace={trace} />
    </Container>
  );
};

export default App;
