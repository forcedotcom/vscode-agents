import React from 'react';
import ChatSession from './chatSession';
import { CssBaseline, Container } from '@mui/material';

const App: React.FC = () => {
  const session = {
    id: '12345',
    startTime: 'Feb 21, 2025 - 10:30 AM',
    prompt: `Hello! What's the weather like today?`,
    topic: {
      name: 'Weather and temperature information',
      description:
        'Provide information about and forecasts of the weather and temperature around Coral Cloud Resort and Port Aurelia. This topic is triggered by user inquiries regarding weather conditions and temperature forecasts for these locations.',
      instructions: [
        'If a user requests a forecast, imagine a detailed weather forecast for the next 7 days for Coral Cloud Resort and Port Aurelia.',
        'If the user inquires about specific weather conditions (e.g., rain, wind), include this information in your response.',
        'When providing temperature information, specify whether it is in Celsius or Fahrenheit.',
        'Always specify the date and time of the weather information provided.',
        'When a user asks about the weather, provide the current weather conditions and temperature for Coral Cloud Resort and Port Aurelia. Imagine a temperature that is never cooler than 70 degrees or hotter than 100 degrees Fahrenheit.'
      ],
      actions: []
    },
    reasoning:
      'SMALL_TALK: The response is small talk, as it is asking the user for more information without providing any specific data. Nothing in the response indicates a prompt injection.',
    response:
      'I can get you the current weather conditions and temperature for Coral Cloud Resort and Port Aurelia. Which location are you interested in?',
    planId: '234bf5e67fd8c90'
  };

  return (
    <Container maxWidth="md">
      <CssBaseline />
      <ChatSession session={session} />
    </Container>
  );
};

export default App;
