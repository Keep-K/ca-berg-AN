import { useEffect, useRef } from 'react';
import { webSocketManager } from '../services/websocket';
import { useAuth, AUTH_TOKEN_KEY } from '../context/AuthContext';

function sendAuthIfToken() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token && webSocketManager.isConnected()) {
    webSocketManager.send({ type: 'auth', token });
  }
}

export function useWebSocket(onMessage?: (data: any) => void) {
  const { token } = useAuth();
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    webSocketManager.connect();

    const unsubConnection = webSocketManager.onConnection(sendAuthIfToken);

    let unsubMessage: (() => void) | undefined;
    if (onMessageRef.current) {
      unsubMessage = webSocketManager.onMessage((data) => {
        if (onMessageRef.current) onMessageRef.current(data);
      });
    }

    return () => {
      unsubConnection();
      if (unsubMessage) unsubMessage();
    };
  }, []);

  useEffect(() => {
    if (token && webSocketManager.isConnected()) {
      webSocketManager.send({ type: 'auth', token });
    }
  }, [token]);

  return {
    send: (data: any) => webSocketManager.send(data),
    isConnected: () => webSocketManager.isConnected(),
  };
}
