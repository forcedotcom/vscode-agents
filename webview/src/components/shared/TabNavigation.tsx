import React from 'react';
import './TabNavigation.css';

interface TabNavigationProps {
  activeTab: 'preview' | 'tracer';
  onTabChange: (tab: 'preview' | 'tracer') => void;
  showTracerTab?: boolean;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, showTracerTab = false }) => {
  const handleTabClick = (tab: 'preview' | 'tracer') => {
    onTabChange(tab);
  };

  return (
    <nav className="tab-navigation">
      <div className="tab-navigation-left">
        <button className={`tab ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => handleTabClick('preview')}>
          <span className="tab-icon tab-icon-comment"></span>
          Agent Preview
        </button>
        {showTracerTab && (
          <button className={`tab ${activeTab === 'tracer' ? 'active' : ''}`} onClick={() => handleTabClick('tracer')}>
            <span className="tab-icon tab-icon-tree"></span>
            Agent Tracer
          </button>
        )}
      </div>
    </nav>
  );
};

export default TabNavigation;
