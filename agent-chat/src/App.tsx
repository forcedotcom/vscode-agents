import React, { useRef, useState, useEffect } from 'react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  Avatar,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { AgentPreview, AgentPreviewSendResponse } from '@salesforce/agents';
import fs from 'fs';
import path from 'path';
// import { tmpdir } from 'os';
import salesforceLogo from './assets/salesforce.png';
import './index.css';
interface Message {
  id: number;
  timestamp: Date;
  role: 'system' | 'user';
  content: string;
}
const initialComment: Message = {
  content: `Hi, I'm an AI service assistant. How can I help you?`,
  role: 'system',
  id: 1,
  timestamp: new Date()
};

interface AppProps {
  readonly agent: AgentPreview;
  readonly id: string;
  readonly name: string;
}
const saveTranscriptsToFile = (
  tempDir: string,
  messages: Array<{ timestamp: Date; role: string; content: string }>,
  responses: AgentPreviewSendResponse[]
): void => {
  if (!tempDir) return;
  fs.mkdirSync(tempDir, { recursive: true });

  const transcriptPath = path.join(tempDir, 'transcript.json');
  fs.writeFileSync(transcriptPath, JSON.stringify(messages, null, 2));

  const responsesPath = path.join(tempDir, 'responses.json');
  fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
};

const App: React.FC<AppProps> = props => {
  // Inside your component
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [sendDisabled, setSendDisabled] = useState(false);
  const [_sessionId, setSessionId] = useState('');
  const [timestamp, _setTimestamp] = useState(new Date().getTime());
  const [tempDir, setTempDir] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([initialComment]);
  const { agent, id, name } = props;
  const [responses, _setResponses] = React.useState<AgentPreviewSendResponse[]>([]);
  useEffect(() => {
    const startSession = async (): Promise<void> => {
      const session = await agent.start(id);
      setSessionId(session.sessionId);
      await sleep(1500);
      setIsThinking(false);
      setTempDir(path.join(__dirname, 'agent-preview', `${timestamp}-${session.sessionId}`));
      setMessages([{ role: name, content: session.messages[0].message, timestamp: new Date() } as Message]);
    };

    void startSession();
  }, []);
  useEffect(() => {
    saveTranscriptsToFile(tempDir, messages, responses);
  }, [tempDir, messages, responses]);
  const vscode = window.acquireVsCodeApi();

  const sendMessage = (message: string) => {
    vscode.postMessage({ type: 'NEW_PROMPT', payload: message });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const handleSend = async (content: string) => {
    if (!content) return;
    setQuery('');
    setSendDisabled(true);
    setIsThinking(true);
    setMessages(prev => [...prev, { id: prev.length + 1, role: 'user', content: content, timestamp: new Date() }]);
    await sleep(1500);
    // const response = await agent.send(sessionId, content);
    // setResponses(prev => [...prev, response]);
    // const message = response.messages[0].message;

    // if (!message) {
    //   throw new Error('Failed to send message');
    // }

    setIsThinking(false);
    setMessages(prev => {
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
    sendMessage(content);
    setSendDisabled(false);
    // Add the agent's response to the chat
    // setMessages(prev => [...prev, { role: name, content: message, timestamp: new Date() }]);
    // Ensure the input regains focus
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <MainContainer className="chat-wrapper">
      <ChatContainer className="chat-container">
        <MessageList
          className="message-list"
          typingIndicator={isThinking ? <TypingIndicator content="Thinking..." /> : null}
        >
          {messages.map(msg => (
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
