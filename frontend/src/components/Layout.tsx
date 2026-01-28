import React, { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

export default Layout;
