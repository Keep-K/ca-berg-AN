import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './TopBar.css';

type TopBarProps = {
  onToggleSidebar?: () => void;
  onOpenSidebar?: () => void;
};

function TopBar({ onToggleSidebar, onOpenSidebar }: TopBarProps) {
  const [exchanges, setExchanges] = useState<string[]>([]);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.getExchanges().then((data) => {
      setExchanges(data.exchanges || []);
    }).catch(() => setExchanges([]));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu"
          aria-label="Open menu"
          onClick={onToggleSidebar || onOpenSidebar}
        >
          ☰
        </button>
        <h2>Portfolio Monitor</h2>
      </div>
      <div className="topbar-right">
        <div className="exchanges-indicator">
          <span className="label">Connected:</span>
          <span className="count">{exchanges.length}</span>
        </div>
        <button type="button" className="topbar-logout" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default TopBar;
