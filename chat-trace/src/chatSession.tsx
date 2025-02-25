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
  IconButton,
  Divider
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

interface PromptDetails {
  prompt: string;
  topic: TopicDetails;
  reasoning: string;
  response: string;
  planId: string;
}

interface SessionDetails {
  id: string;
  startTime: string;
  prompts: PromptDetails[];
}

const ChatSession: React.FC<{ session: SessionDetails }> = ({ session }) => {
  return (
    <div>
      {/* Card for session start details */}
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
          <Divider sx={{ my: 1, width: '800px' }} />
          <Typography variant="body2">
            <strong>Session started:</strong> {session.startTime}
          </Typography>
          <Typography variant="body2">
            <strong>Session ID:</strong> {session.id}
          </Typography>
        </CardContent>
      </Card>
      {/* Generate an Accordion for each prompt */}
      {session.prompts.map((promptDetails, index) => (
        <Accordion key={index} defaultExpanded sx={{ mb: 2, borderRadius: '10px' }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              alignItems: 'center',
              flexDirection: 'row-reverse',
              backgroundColor: '#c6e3fa',
              borderRadius: '10px 10px 0px 0px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="body2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                {promptDetails.prompt}
              </Typography>
              <Typography
                variant="body2"
                fontWeight="bold"
                style={{
                  padding: '5px 10px',
                  border: '1px solid black',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: 'white'
                }}
              >
                <strong>Plan ID:</strong> {promptDetails.planId}
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
                  <Typography variant="body2">{promptDetails.prompt}</Typography>
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
                        {promptDetails.topic.name}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {promptDetails.topic.description}
                      </Typography>

                      {/* Accordion for Instructions */}
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Instructions ({promptDetails.topic.instructions.length})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <List dense>
                            {promptDetails.topic.instructions.map((instruction, index) => (
                              <ListItem key={index}>
                                <ListItemText primary={`- ${instruction}`} />
                              </ListItem>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>

                      {/* Accordion for Actions */}
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Actions ({promptDetails.topic.actions.length})
                          </Typography>
                        </AccordionSummary>
                        {promptDetails.topic.actions.length > 0 && (
                          <AccordionDetails>
                            <List dense>
                              {promptDetails.topic.actions.map((action, index) => (
                                <ListItem key={index}>
                                  <ListItemText primary={`✓ ${action}`} />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        )}
                      </Accordion>
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
                  <Typography variant="body2">{promptDetails.reasoning}</Typography>
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
                  <Typography variant="body2">{promptDetails.response}</Typography>
                </TimelineContent>
              </TimelineItem>
            </Timeline>
          </AccordionDetails>
        </Accordion>
      ))}
    </div>
  );
};

export default ChatSession;
