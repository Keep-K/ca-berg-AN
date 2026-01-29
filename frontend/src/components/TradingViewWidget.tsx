import React, { useEffect, useMemo } from 'react';

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface TradingViewWidgetProps {
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
}

function TradingViewWidget({ symbol, interval = '60', theme = 'dark' }: TradingViewWidgetProps) {
  const containerId = useMemo(
    () => `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random().toString(36).slice(2)}`,
    [symbol]
  );

  useEffect(() => {
    let isMounted = true;
    let cleanupLoad: (() => void) | null = null;

    const initWidget = () => {
      if (!isMounted || !window.TradingView) return;

      // eslint-disable-next-line no-new
      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: 'Etc/UTC',
        theme,
        style: '1',
        locale: 'en',
        enable_publishing: false,
        hide_legend: false,
        allow_symbol_change: true,
        container_id: containerId,
      });
    };

    if (window.TradingView) {
      initWidget();
    } else {
      const scriptId = 'tradingview-widget-script';
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!existing) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        const onLoad = () => initWidget();
        script.addEventListener('load', onLoad, { once: true });
        cleanupLoad = () => script.removeEventListener('load', onLoad);
        document.body.appendChild(script);
      } else {
        const onLoad = () => initWidget();
        existing.addEventListener('load', onLoad, { once: true });
        cleanupLoad = () => existing.removeEventListener('load', onLoad);
        const intervalId = window.setInterval(() => {
          if (window.TradingView) {
            window.clearInterval(intervalId);
            initWidget();
          }
        }, 200);
      }
    }

    return () => {
      isMounted = false;
      if (cleanupLoad) cleanupLoad();
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId, interval, symbol, theme]);

  return <div id={containerId} className="tradingview-widget" />;
}

export default TradingViewWidget;
