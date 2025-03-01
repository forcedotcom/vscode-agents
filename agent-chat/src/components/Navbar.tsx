import { AppBar, Toolbar, IconButton, Menu, MenuItem, Button, Typography } from '@mui/material';
import { ArrowDropDown, CallEnd } from '@mui/icons-material';
import { useState } from 'react';

const Navbar = ({
  currentAgent,
  setCurrentAgent,
  onAgentSelect,
  onEndSession
}: {
  currentAgent: string;
  setCurrentAgent: (agent: string) => void;
  onAgentSelect: (agent: string) => void;
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

  const handleSelectAgent = (agent: string) => {
    setCurrentAgent(agent);
    onAgentSelect(agent);
    handleMenuClose();
  };

  return (
    <AppBar position="static" color="default" elevation={1} className="navbar">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {currentAgent}
        </Typography>

        <IconButton onClick={handleMenuOpen}>
          <ArrowDropDown />
        </IconButton>
        <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
          <MenuItem onClick={() => handleSelectAgent('Local Info Agent')}>Local Info Agent</MenuItem>
          <MenuItem onClick={() => handleSelectAgent('Guest Experience Agent')}>Guest Experience Agent</MenuItem>
        </Menu>

        {/* End Session Button */}
        <Button
          variant="contained"
          color="error"
          startIcon={<CallEnd />}
          onClick={onEndSession}
          aria-label="End session"
        />
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
