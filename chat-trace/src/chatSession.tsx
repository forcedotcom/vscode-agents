import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';

interface TopicDetails {
  name: string;
  description: string;
  instructions: string[];
  actions: string[];
}

interface SessionDetails {
  id: string;
  startTime: string;
  prompt: string;
  topic: TopicDetails;
  reasoning: string;
  response: string;
  planId: string;
}

const ChatSession: React.FC<{ session: SessionDetails }> = ({ session }) => {
  return (
    <div>
      <Card sx={{ width: '100%', mx: 'auto', mb: 2, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconButton color="primary">
              <PlayArrowIcon />
            </IconButton>
            <Typography variant="h6" fontWeight="bold">
              Session Start
            </Typography>
          </div>
          <Typography variant="body2">
            <strong>Session started:</strong> {session.startTime}
          </Typography>
          <Typography variant="body2">
            <strong>Session ID:</strong> {session.id}
          </Typography>
        </CardContent>
      </Card>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Typography variant="body2" fontWeight="bold">
              {session.prompt}
            </Typography>
            <Typography
              variant="body2"
              fontWeight="bold"
              style={{
                padding: '5px 10px',
                border: '1px solid black',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <strong>Plan ID:</strong> {session.planId}
            </Typography>
          </div>
        </AccordionSummary>
        <AccordionDetails sx={{ width: '100%', maxWidth: '1500px', mx: 'auto', px: 4 }}>
          <Timeline sx={{ width: '100%', maxWidth: '1500px', mx: 'auto', px: 4 }}>
            <TimelineItem>
              <TimelineSeparator>
                <TimelineDot color="primary" />
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent sx={{ flexGrow: 1, minWidth: '700px' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  User Prompt
                </Typography>
                <Typography variant="body2">{session.prompt}</Typography>
              </TimelineContent>
            </TimelineItem>

            {/* Topic with Card */}
            <TimelineItem>
              <TimelineSeparator>
                <TimelineDot color="secondary" />
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent sx={{ flexGrow: 1, minWidth: '700px' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Select Topic
                </Typography>
                <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {session.topic.name}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {session.topic.description}
                    </Typography>

                    <Typography variant="subtitle2" fontWeight="bold">
                      Instructions:
                    </Typography>
                    <List dense>
                      {session.topic.instructions.map((instruction, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={`- ${instruction}`} />
                        </ListItem>
                      ))}
                    </List>

                    <Typography variant="subtitle2" fontWeight="bold">
                      Actions Taken:
                    </Typography>
                    <List dense>
                      {session.topic.actions.map((action, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={`✓ ${action}`} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>

            <TimelineItem>
              <TimelineSeparator>
                <TimelineDot color="success" />
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent sx={{ flexGrow: 1, minWidth: '700px' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Agent's Reasoning
                </Typography>
                <Typography variant="body2">{session.reasoning}</Typography>
              </TimelineContent>
            </TimelineItem>

            <TimelineItem>
              <TimelineSeparator>
                <TimelineDot color="error" />
              </TimelineSeparator>
              <TimelineContent sx={{ flexGrow: 1, minWidth: '700px' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Final Response
                </Typography>
                <Typography variant="body2">{session.response}</Typography>
              </TimelineContent>
            </TimelineItem>
          </Timeline>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default ChatSession;
