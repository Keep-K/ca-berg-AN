import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeSidebar]);

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <button
        type="button"
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        aria-label="Close menu overlay"
        onClick={closeSidebar}
      />
      <div className="main-content">
        <TopBar onToggleSidebar={toggleSidebar} onOpenSidebar={openSidebar} />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

export default Layout;
