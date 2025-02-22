import React, { useRef } from 'react';
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, Avatar } from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import salesforceLogo from './assets/salesforce.png';
import './index.css';

const App: React.FC = () => {
  // Inside your component
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState('');
  const [sendDisabled, setSendDisabled] = React.useState(false);
  const [comments, setComments] = React.useState<
    Array<{ id: number; timestamp: Date; role: 'system' | 'user'; content: string }>
  >([{ content: 'Hello! How can I help?', role: 'system', id: 1, timestamp: new Date() }]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const handleSend = async (content: string) => {
    if (!content) return;
    setQuery('');
    setSendDisabled(true);

    setComments(prev => [...prev, { id: prev.length + 1, role: 'user', content: content, timestamp: new Date() }]);
    await sleep(1000);

    setComments(prev => {
      const lastComment = prev[prev.length - 1];
      // TODO - use agents library for generations
      return (Math.random() * 2) % 2 > 1
        ? [
            ...prev,
            {
              id: prev.length + 1,
              role: 'system',
              content: "I'm sorry, I can't help with this request",
              timestamp: new Date()
            }
          ]
        : [
            ...prev,
            { ...lastComment, id: prev.length + 1, role: 'system', content: 'We have a scuba class at 9:30 AM' }
          ];
    });
    setSendDisabled(false);
    // Ensure the input regains focus
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <MainContainer className="chat-wrapper">
      <ChatContainer className="chat-container">
        <MessageList className="message-list">
          {comments.map(msg => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {msg.role === 'system' && <Avatar size="md" color="blue" src={salesforceLogo} />}
              <Message
                key={msg.id}
                model={{
                  message: msg.content,
                  sender: msg.role,
                  direction: msg.role === 'system' ? 'incoming' : 'outgoing',
                  position: 'normal'
                }}
              />
            </div>
          ))}
        </MessageList>
        <MessageInput
          ref={inputRef}
          value={query}
          placeholder="Start typing..."
          onChange={setQuery}
          disabled={sendDisabled}
          onSend={handleSend}
          attachButton={false}
        />
      </ChatContainer>
    </MainContainer>
  );
};

export default App;
