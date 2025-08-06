import React from 'react';
import './DebugToggle.css';

interface DebugToggleProps {
  isEnabled: boolean;
  onChange: (enabled: boolean) => void;
}

const DebugToggle: React.FC<DebugToggleProps> = ({ isEnabled, onChange }) => {
  return (
    <div className="debug-toggle">
      <label className="debug-toggle-label">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => onChange(e.target.checked)}
          className="debug-toggle-checkbox"
        />
        <span className="debug-toggle-slider"></span>
        <span className="debug-toggle-text">Debug Mode</span>
      </label>
    </div>
  );
};

export default DebugToggle;