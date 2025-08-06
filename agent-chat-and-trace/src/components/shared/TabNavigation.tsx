import React from 'react';
import './TabNavigation.css';
import commentIcon from '../../assets/comment.svg';
import treeIcon from '../../assets/tree.svg';

interface TabNavigationProps {
  activeTab: 'preview' | 'tracer';
  onTabChange: (tab: 'preview' | 'tracer') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const handleTabClick = (tab: 'preview' | 'tracer') => {
    onTabChange(tab);
  };

  return (
    <nav className="tab-navigation">
      <div className="tab-navigation-left">
        <button 
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => handleTabClick('preview')}
        >
          <img src={commentIcon} alt="Comment" className="tab-icon-svg" />
          Agent Preview
        </button>
        <button 
          className={`tab ${activeTab === 'tracer' ? 'active' : ''}`}
          onClick={() => handleTabClick('tracer')}
        >
          <img src={treeIcon} alt="Tree" className="tab-icon-svg" />
          Agent Tracer
        </button>
      </div>
    </nav>
  );
};

export default TabNavigation;