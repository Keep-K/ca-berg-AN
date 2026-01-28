import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import './Alerts.css';

interface AlertEvent {
  type: 'large_balance_change' | 'large_position_opening' | 'rapid_drawdown' | 'connection_lost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  exchange?: string;
  timestamp: number;
  data?: any;
}

function Alerts() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const { send, isConnected } = useWebSocket((data) => {
    if (data.type === 'alert') {
      setAlerts((prev) => [data.data, ...prev]);
    }
  });

  useEffect(() => {
    // Subscribe to alerts channel when connected
    const checkConnection = setInterval(() => {
      if (isConnected()) {
        send({ type: 'subscribe', channels: ['alerts'] });
        clearInterval(checkConnection);
      }
    }, 100);

    return () => clearInterval(checkConnection);
  }, [isConnected, send]);

  useEffect(() => {
    // Initial mock data - replace with API call if needed
    setAlerts([
      {
        type: 'large_balance_change',
        severity: 'warning',
        message: 'Large balance change detected: BTC on Binance. Change: $10,000.00 (5.2%)',
        exchange: 'binance',
        timestamp: Date.now() - 1800000,
        data: {
          asset: 'BTC',
          previousValue: 190000,
          currentValue: 200000,
          change: 10000,
          changePercent: 5.2,
        },
      },
      {
        type: 'large_position_opening',
        severity: 'info',
        message: 'Large position opened: ETH/USDT LONG on Bybit. Value: $50,000.00',
        exchange: 'bybit',
        timestamp: Date.now() - 3600000,
        data: {
          symbol: 'ETH/USDT',
          side: 'long',
          size: 20,
          value: 50000,
          leverage: 10,
        },
      },
      {
        type: 'rapid_drawdown',
        severity: 'critical',
        message: 'Rapid drawdown detected: Portfolio decreased by -5.2%',
        timestamp: Date.now() - 7200000,
        data: {
          previousEquity: 100000,
          currentEquity: 94800,
          change: -5200,
          changePercent: -5.2,
        },
      },
    ]);
    setLoading(false);
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const getSeverityClass = (severity: string) => {
    return `alert-item alert-${severity}`;
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <div className="page-header">
        <h1>Alerts</h1>
        <div className="page-summary">
          Total: <strong>{alerts.length}</strong>
        </div>
      </div>
      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="empty-state">No alerts</div>
        ) : (
          alerts.map((alert, index) => (
            <div key={index} className={getSeverityClass(alert.severity)}>
              <div className="alert-header">
                <span className="alert-icon">{getSeverityIcon(alert.severity)}</span>
                <div className="alert-meta">
                  <span className="alert-type">{alert.type.replace(/_/g, ' ')}</span>
                  {alert.exchange && (
                    <span className="alert-exchange">{alert.exchange.toUpperCase()}</span>
                  )}
                  <span className="alert-time">
                    {new Date(alert.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div className="alert-message">{alert.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Alerts;
