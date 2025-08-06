import React, { useState } from "react";
import ChatContainer from "./ChatContainer";
import FormContainer from "./FormContainer";
import "./AgentChat.css";

interface Message {
  id: string;
  type: "user" | "agent" | "system";
  content: string;
  systemType?: "session" | "debug";
}

const AgentChat: React.FC = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "system",
      content: "Session was started.",
      systemType: "session",
    },
    {
      id: "2",
      type: "agent",
      content:
        "Hi! I'm Agentforce, an AI assistant. I can do things like search for information, summarize records, and draft and revise emails. What can I help you with?",
    },
    {
      id: "3",
      type: "user",
      content: "What is the weather like at the resort on June 11th?",
    },
    {
      id: "4",
      type: "agent",
      content:
        "The weather at Coral Cloud Resort on June 11th will have temperatures ranging from 14.6°C to 28.7°C. It sounds like a pleasant day!",
    },
    {
      id: "5",
      type: "system",
      content: "Debug mode was activated.",
      systemType: "debug",
    },
    {
      id: "6",
      type: "user",
      content: "What's the weather like today?",
    },
    {
      id: "7",
      type: "agent",
      content:
        "I'm sorry, but it seems there was an issue accessing the weather information at the moment. It might be due to a technical problem with the service. Please try again later or check a reliable weather website or app for the latest updates.",
    },
    {
      id: "8",
      type: "system",
      content: "Debug mode was deactivated.",
      systemType: "debug",
    },
    {
      id: "9",
      type: "system",
      content: "Session was terminated.",
      systemType: "session",
    },
  ]);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  return (
    <div className="agent-chat">
      <ChatContainer messages={messages} />
      <FormContainer
        debugMode={debugMode}
        onDebugModeChange={setDebugMode}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};

export default AgentChat;
