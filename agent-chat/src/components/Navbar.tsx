import {
  AppBar,
  Box,
  FormGroup,
  FormControlLabel,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  Typography
} from '@mui/material';
import { ArrowDropDown, CallEnd } from '@mui/icons-material';
import { useState } from 'react';

type AgentOption = {
  Id: string;
  MasterLabel: string;
};

const Navbar = ({
  agents,
  currentAgent,
  selectable,
  setCurrentAgent,
  setApexDebugging,
  onAgentSelect,
  onEndSession
}: {
  agents: Array<AgentOption>;
  currentAgent: string;
  selectable: boolean;
  setCurrentAgent: (agent: string) => void;
  setApexDebugging: (debugging: boolean) => void;
  onAgentSelect: (agent: AgentOption) => void;
  onEndSession: () => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [apexDebugging, setSwitchState] = useState(false);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSwitchState(event.target.checked);
    setApexDebugging(event.target.checked);
  };

  const handleSelectAgent = (agent: AgentOption) => {
    setCurrentAgent(agent.MasterLabel);
    onAgentSelect(agent);
    handleMenuClose();
  };

  return (
    <Box sx={{ flexGrow: 0, height: '6rem' }} className="navbar-container">
      <AppBar position="static" color="default" elevation={1} className="navbar">
        <Toolbar>
          <Typography
            variant="subtitle1"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {currentAgent}
          </Typography>

          <IconButton onClick={handleMenuOpen}>{selectable && <ArrowDropDown />}</IconButton>
          <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
            {agents.map(agent => (
              <MenuItem key={agent.Id} onClick={() => handleSelectAgent(agent)}>
                {agent.MasterLabel}
              </MenuItem>
            ))}
          </Menu>
          {!selectable && (
            <IconButton color="error" onClick={onEndSession} aria-label="End session">
              <CallEnd />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
      <FormGroup sx={{ pl: '20px', pt: '10px' }}>
        <FormControlLabel
          control={<Switch checked={apexDebugging} onChange={handleChange} size="small" />}
          label={apexDebugging ? 'Apex Debugging Enabled' : 'Apex Debugging Disabled'}
          slotProps={{ typography: { variant: 'body2' } }}
        />
      </FormGroup>
    </Box>
  );
};

export default Navbar;
