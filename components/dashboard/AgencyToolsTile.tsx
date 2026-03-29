import React from 'react';

interface AgencyToolsTileProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  headerContent: React.ReactNode;
  bodyContent?: React.ReactNode;
}

export default function AgencyToolsTile({
  title,
  isOpen,
  onToggle,
  headerContent,
  bodyContent,
}: AgencyToolsTileProps) {
  return (
    <div
      className={`ag-tile ${isOpen ? 'open' : ''}`}
      onClick={onToggle}
      style={{ cursor: 'pointer' }}
    >
      <div className="ag-tile-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: '700',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: '#94a3b8',
              marginBottom: '6px',
            }}
          >
            {title}
          </div>
          {headerContent}
        </div>
      </div>
      <span className="ag-tile-chev">▼</span>
      <div className="ag-tile-body">
        <div className="ag-tile-divider"></div>
        {bodyContent}
      </div>
    </div>
  );
}
