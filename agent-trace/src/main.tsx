import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// import { WithVSCodeContext } from './contexts/VSCodeContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*<WithVSCodeContext>*/}
    <App />
    {/*</WithVSCodeContext>*/}
  </StrictMode>
);

interface TopicDetails {
  name: string;
  description: string;
  instructions: string[];
  actions: string[];
}

interface PromptDetails {
  prompt: string;
  topic: TopicDetails;
  reasoning: string;
  response: string;
  planId: string;
}

export interface SessionDetails {
  id: string;
  startTime: string;
  prompts: PromptDetails[];
}
