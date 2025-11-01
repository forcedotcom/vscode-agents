import React from 'react';
import './TabNavigation.css';

interface TabNavigationProps {
  activeTab: 'preview' | 'tracer';
  onTabChange: (tab: 'preview' | 'tracer') => void;
  showTracerTab?: boolean;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, showTracerTab = false }) => {
  const tabRefs = React.useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = React.useState({ width: 0, left: 0 });

  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        width: activeTabElement.offsetWidth,
        left: activeTabElement.offsetLeft,
      });
    }
  }, [activeTab, showTracerTab]);

  const handleTabClick = (tab: 'preview' | 'tracer') => {
    onTabChange(tab);
  };

  return (
    <nav className="tab-navigation">
      <div className="tab-navigation-left">
        <button
          ref={(el) => (tabRefs.current['preview'] = el)}
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => handleTabClick('preview')}
        >
          <span className="tab-icon tab-icon-comment"></span>
          Agent Preview
        </button>
        {showTracerTab && (
          <button
            ref={(el) => (tabRefs.current['tracer'] = el)}
            className={`tab ${activeTab === 'tracer' ? 'active' : ''}`}
            onClick={() => handleTabClick('tracer')}
          >
            <span className="tab-icon tab-icon-tree"></span>
            Agent Tracer
          </button>
        )}
        <div
          className="tab-navigation-indicator"
          style={{
            width: `${indicatorStyle.width}px`,
            transform: `translateX(${indicatorStyle.left}px)`,
          }}
        />
      </div>
    </nav>
  );
};

export default TabNavigation;
