import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// import { WithVSCodeContext } from './contexts/VSCodeContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* <WithVSCodeContext> */}
    <App />
    {/* </WithVSCodeContext> */}
  </StrictMode>
);
