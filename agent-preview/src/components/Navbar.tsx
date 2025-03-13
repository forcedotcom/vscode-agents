import { AppBar, Toolbar, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { ArrowDropDown, CallEnd } from '@mui/icons-material';
import { useState } from 'react';

const Navbar = ({
  agents,
  currentAgent,
  selectable,
  setCurrentAgent,
  onAgentSelect,
  onEndSession
}: {
  agents: any[];
  currentAgent: string;
  selectable:boolean;
  setCurrentAgent: (agent: string) => void;
  onAgentSelect: (agent: { Id: string; MasterLabel: string }) => void;
  onEndSession: () => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSelectAgent = (agent: { Id: string; MasterLabel: string }) => {
    setCurrentAgent(agent.MasterLabel);
    onAgentSelect(agent);
    handleMenuClose();
  };

  return (
    <AppBar position="static" color="default" elevation={1} className="navbar">
      <Toolbar>
        <Typography
          variant="h6"
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

        <IconButton onClick={handleMenuOpen}>
          {selectable && <ArrowDropDown /> }
        </IconButton>
        <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
          {agents.map(agent => (
            <MenuItem onClick={() => handleSelectAgent(agent)}>{agent.MasterLabel}</MenuItem>
          ))}
        </Menu>
        {!selectable && (
          <IconButton color="error" onClick={onEndSession} aria-label="End session">
            <CallEnd />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
