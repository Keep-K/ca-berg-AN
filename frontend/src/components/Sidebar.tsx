import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Overview', icon: '📊' },
    { path: '/portfolio', label: 'Portfolio', icon: '💼' },
    { path: '/positions', label: 'Positions', icon: '📈' },
    { path: '/orders', label: 'Orders', icon: '📜' },
    { path: '/trades', label: 'Trade History', icon: '📊' },
    { path: '/trading', label: 'Trading', icon: '💰' },
    { path: '/exchanges', label: 'Exchanges', icon: '🔌' },
    { path: '/alerts', label: 'Alerts', icon: '🚨' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Portfolio Monitor</h1>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
