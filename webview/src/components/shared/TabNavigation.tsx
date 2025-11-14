import React from 'react';
import './TabNavigation.css';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabNavigationProps {
  activeTab: number | 'preview' | 'tracer';
  onTabChange: (tab: any) => void;
  showTracerTab?: boolean;
  tabs?: Tab[];
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, showTracerTab = false, tabs }) => {
  const tabRefs = React.useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = React.useState({ width: 0, left: 0 });

  // Use custom tabs if provided, otherwise use default tabs
  const isCustomTabs = tabs && tabs.length > 0;

  React.useEffect(() => {
    if (isCustomTabs) {
      const activeTabElement = tabRefs.current[activeTab.toString()];
      if (activeTabElement) {
        setIndicatorStyle({
          width: activeTabElement.offsetWidth,
          left: activeTabElement.offsetLeft,
        });
      }
    } else {
      const activeTabElement = tabRefs.current[activeTab as string];
      if (activeTabElement) {
        setIndicatorStyle({
          width: activeTabElement.offsetWidth,
          left: activeTabElement.offsetLeft,
        });
      }
    }
  }, [activeTab, showTracerTab, isCustomTabs, tabs]);

  const handleTabClick = (tab: any) => {
    onTabChange(tab);
  };

  return (
    <nav className="tab-navigation">
      <div className="tab-navigation-left">
        {isCustomTabs ? (
          // Render custom tabs
          <>
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(el) => (tabRefs.current[index.toString()] = el)}
                className={`tab ${activeTab === index ? 'active' : ''}`}
                onClick={() => handleTabClick(index)}
              >
                {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                {tab.label}
              </button>
            ))}
          </>
        ) : (
          // Render default tabs
          <>
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
          </>
        )}
        {indicatorStyle.width > 0 && (
          <div
            className="tab-navigation-indicator"
            style={{
              width: `${indicatorStyle.width}px`,
              transform: `translateX(${indicatorStyle.left}px)`,
            }}
          />
        )}
      </div>
    </nav>
  );
};

export default TabNavigation;
