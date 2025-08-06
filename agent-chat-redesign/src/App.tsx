import React from 'react';
import AgentChat from './components/AgentChat/AgentChat';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <div className="app-content">
        <AgentChat />
      </div>
    </div>
  );
};

export default App;