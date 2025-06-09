import React, { useEffect, useState } from 'react';
import ChatSession from './chatSession';
import { CssBaseline, Container } from '@mui/material';
import { SessionDetails } from './main';

const App: React.FC = () => {
  const [trace, setTrace] = useState<SessionDetails | undefined>(undefined);

  useEffect(() => {
    window.addEventListener('message', event => {
      const { command, data } = event.data;
      if (command === 'setTrace') {
        if (trace) {
          // it's already been started, add to the prompts
          trace.prompts.push(data.prompts);
          setTrace(trace);
        }
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
