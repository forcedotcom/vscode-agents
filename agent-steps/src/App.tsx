import React, { useState } from 'react';

const App: React.FC = () => {
  console.log('React App Loaded!');
  const [messages, setMessages] = useState<string[]>([]);
  const [history, _setHistory] = useState<string[]>([
    'Logged into Salesforce',
    'Queried customer information',
    'Performed action XYZ',
    'Generated report'
  ]);

  const sendMessage = (message: string) => {
    setMessages([...messages, message]);
    window.acquireVsCodeApi().postMessage({ command: 'newMessage', text: message });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', margin: 0, fontFamily: 'Arial, sans-serif' }}>
      <div
        style={{
          width: '50%',
          backgroundColor: '#fff',
          padding: '10px',
          borderLeft: '1px solid #ccc',
          overflowY: 'auto'
        }}
      >
        <h2>History of Steps</h2>
        <div>
          {history.map((step, idx) => (
            <div
              key={idx}
              className="history-step"
              style={{ backgroundColor: '#e0e0e0', padding: '8px', margin: '5px 0', borderRadius: '5px' }}
            >
              {step}
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: '50%', backgroundColor: '#f5f5f5', padding: '10px', overflowY: 'auto' }}>
        <h2>Chat</h2>
        <div id="chat-messages">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className="chat-message"
              style={{ backgroundColor: '#d1f7c4', padding: '5px', margin: '5px 0', borderRadius: '5px' }}
            >
              {msg}
            </div>
          ))}
        </div>
        <textarea id="message-input" placeholder="Type your message..." rows={3} style={{ width: '100%' }} />
        <button onClick={() => sendMessage((document.getElementById('message-input') as HTMLTextAreaElement).value)}>
          Send
        </button>
      </div>
    </div>
  );
};

export default App;
