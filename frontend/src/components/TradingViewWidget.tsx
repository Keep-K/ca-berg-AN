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
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = initWidget;
        document.body.appendChild(script);
      } else {
        const existing = document.getElementById(scriptId) as HTMLScriptElement;
        if (existing && existing.onload) {
          // no-op, wait for onload
        } else {
          const intervalId = window.setInterval(() => {
            if (window.TradingView) {
              window.clearInterval(intervalId);
              initWidget();
            }
          }, 200);
        }
      }
    }

    return () => {
      isMounted = false;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId, interval, symbol, theme]);

  return <div id={containerId} className="tradingview-widget" />;
}

export default TradingViewWidget;
