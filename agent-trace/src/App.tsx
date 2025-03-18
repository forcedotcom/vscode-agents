import React from 'react';
import ChatSession from './chatSession';
import { CssBaseline, Container } from '@mui/material';

const App: React.FC = () => {
  const session = {
    id: '12345',
    startTime: 'Feb 21, 2025 - 10:30 AM',
    prompts: [
      {
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
      },
      {
        prompt: `Port Aurelia, please`,
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
          'GROUNDED: The response provides a detailed 7-day weather forecast for Port Aurelia, including temperatures within the specified range and weather conditions, which aligns with the context provided.',
        response: `Sure! Here's the weather forecast for Port Aurelia for the next 7 days:\n\nMonday, February 24, 2025:\n\n- Temperature: 75°F (24°C)\n- Conditions: Mostly sunny with a few clouds\n- Wind: Light breeze from the northwest\n\nTuesday, February 25, 2025:\n\n- Temperature: 78°F (26°C)\n- Conditions: Partly cloudy\n- Wind: Gentle breeze from the west\n\nWednesday, February 26, 2025:\n\n- Temperature: 80°F (27°C)\n- Conditions: Sunny\n- Wind: Light breeze from the southwest\n\nThursday, February 27, 2025:\n\n- Temperature: 82°F (28°C)\n- Conditions: Mostly sunny\n- Wind: Moderate breeze from the south\n\nFriday, February 28, 2025:\n\n- Temperature: 85°F (29°C)\n- Conditions: Clear skies\n- Wind: Light breeze from the southeast\n\nSaturday, March 1, 2025:\n\n- Temperature: 87°F (31°C)\n- Conditions: Sunny\n- Wind: Gentle breeze from the east\n\nSunday, March 2, 2025:\n\n- Temperature: 88°F (31°C)\n- Conditions: Mostly sunny\n- Wind: Light breeze from the northeast\n\nEnjoy your week in Port Aurelia! If you need more details or have any other questions, feel free to ask.`,
        planId: '675bf5f62fd8e10'
      }
    ]
  };

  return (
    <Container maxWidth="md">
      <CssBaseline />
      <ChatSession session={session} />
    </Container>
  );
};

export default App;
