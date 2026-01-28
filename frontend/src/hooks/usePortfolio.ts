import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { useWebSocket } from './useWebSocket';
import { PortfolioSnapshot } from '../types';

export function usePortfolio() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial snapshot
  useEffect(() => {
    fetchSnapshot();
    
    // Poll every 30 seconds as fallback
    const interval = setInterval(fetchSnapshot, 30000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for real-time updates
  useWebSocket((data) => {
    if (data.type === 'snapshot') {
      setSnapshot(data.data);
      setLoading(false);
    } else if (data.type === 'update') {
      // Handle real-time updates
      // Could refresh snapshot or update specific parts
      fetchSnapshot();
    }
  });

  const fetchSnapshot = async () => {
    try {
      // Try latest snapshot first, if 404 then fetch new snapshot
      let data;
      try {
        data = await apiClient.getLatestSnapshot();
      } catch (err: any) {
        if (err.response?.status === 404) {
          // No snapshot exists, fetch a new one
          console.log('[usePortfolio] No snapshot found, fetching new snapshot...');
          data = await apiClient.getPortfolioSnapshot();
        } else {
          throw err;
        }
      }
      
      setSnapshot(data);
      setLoading(false);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch portfolio:', err);
      setError(err.message || 'Failed to fetch portfolio');
      setLoading(false);
    }
  };

  return { snapshot, loading, error, refetch: fetchSnapshot };
}
