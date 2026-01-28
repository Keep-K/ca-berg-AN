import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import './Exchanges.css';

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance', description: 'Spot + Futures' },
  { id: 'bybit', name: 'Bybit', description: 'Derivatives' },
  { id: 'okx', name: 'OKX', description: 'Unified Account' },
  { id: 'coinbase', name: 'Coinbase', description: 'Spot Trading' },
];

function Exchanges() {
  const [connectedExchanges, setConnectedExchanges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string>('');
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    sandbox: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchExchanges();
  }, []);

  const fetchExchanges = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getExchanges();
      setConnectedExchanges(data.exchanges || []);
    } catch (err: any) {
      console.error('Failed to fetch exchanges:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (exchangeId: string) => {
    setSelectedExchange(exchangeId);
    setFormData({
      apiKey: '',
      apiSecret: '',
      passphrase: '',
      sandbox: false,
    });
    setError(null);
    setSuccess(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedExchange('');
    setError(null);
    setSuccess(null);
  };

  const handleConnect = async () => {
    if (!formData.apiKey || !formData.apiSecret) {
      setError('API Key and API Secret are required');
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.registerExchange({
        exchange: selectedExchange,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        passphrase: formData.passphrase || undefined,
        sandbox: formData.sandbox,
      });

      setSuccess('Exchange connected successfully!');
      setTimeout(() => {
        handleCloseModal();
        fetchExchanges();
      }, 1500);
    } catch (err: any) {
      console.error('Exchange registration error:', err);
      const errorData = err.response?.data;
      const errorMessage = errorData?.details || errorData?.error || err.message || 'Failed to connect exchange';
      console.error('Full error response:', errorData);
      setError(errorMessage);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (exchange: string) => {
    if (!confirm(`Are you sure you want to disconnect ${exchange}?`)) {
      return;
    }

    try {
      await apiClient.removeExchange(exchange);
      fetchExchanges();
      setSuccess(`${exchange} disconnected successfully`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disconnect exchange');
    }
  };

  const selectedExchangeInfo = SUPPORTED_EXCHANGES.find((ex) => ex.id === selectedExchange);

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="exchanges-page">
      <div className="page-header">
        <h1>Exchanges</h1>
        <button className="btn-primary" onClick={() => handleOpenModal('binance')}>
          + Connect Exchange
        </button>
      </div>

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="exchanges-grid">
        {SUPPORTED_EXCHANGES.map((exchange) => {
          const isConnected = connectedExchanges.includes(exchange.id);
          return (
            <div key={exchange.id} className="exchange-card">
              <div className="exchange-card-header">
                <h3>{exchange.name}</h3>
                <span className={`exchange-status ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="exchange-description">{exchange.description}</p>
              <div className="exchange-card-actions">
                {isConnected ? (
                  <button
                    className="btn-danger"
                    onClick={() => handleDisconnect(exchange.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleOpenModal(exchange.id)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Connect {selectedExchangeInfo?.name}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>API Key *</label>
                <input
                  type="text"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Enter your API Key"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>API Secret *</label>
                <input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  placeholder="Enter your API Secret"
                  className="form-input"
                />
              </div>
              {(selectedExchange === 'okx' || selectedExchange === 'coinbase') && (
                <div className="form-group">
                  <label>Passphrase</label>
                  <input
                    type="password"
                    value={formData.passphrase}
                    onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                    placeholder="Enter your Passphrase"
                    className="form-input"
                  />
                </div>
              )}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.sandbox}
                    onChange={(e) => setFormData({ ...formData, sandbox: e.target.checked })}
                  />
                  <span>Use Sandbox/Testnet</span>
                </label>
              </div>
              <div className="form-note">
                <strong>Security Note:</strong> Your API keys are encrypted and stored securely.
                Only read-only permissions are required.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConnect}
                disabled={connecting || !formData.apiKey || !formData.apiSecret}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Exchanges;
