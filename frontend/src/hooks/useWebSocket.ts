import { useEffect, useRef } from 'react';
import { webSocketManager } from '../services/websocket';

export function useWebSocket(onMessage?: (data: any) => void) {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    // Connect on mount
    webSocketManager.connect();

    // Set up message handler
    let unsubscribe: (() => void) | undefined;

    if (onMessageRef.current) {
      unsubscribe = webSocketManager.onMessage((data) => {
        if (onMessageRef.current) {
          onMessageRef.current(data);
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Don't disconnect - other components might be using it
    };
  }, []);

  return {
    send: (data: any) => webSocketManager.send(data),
    isConnected: () => webSocketManager.isConnected(),
  };
}
