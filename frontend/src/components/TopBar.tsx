import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import './TopBar.css';

function TopBar() {
  const [exchanges, setExchanges] = useState<string[]>([]);

  useEffect(() => {
    apiClient.getExchanges().then((data) => {
      setExchanges(data.exchanges || []);
    });
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <h2>Portfolio Monitor</h2>
      </div>
      <div className="topbar-right">
        <div className="exchanges-indicator">
          <span className="label">Connected:</span>
          <span className="count">{exchanges.length}</span>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
