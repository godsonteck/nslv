// ============================================
// NS LUXURY VILLA — Main Application Layout
// Wraps Header + Sidebar + Dynamic Page Viewport
// ============================================

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0F141C] text-[#F3F4F6] overflow-hidden">
      {/* Top Bar */}
      <Header />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Role-aware Sidebar */}
        <Sidebar />

        {/* Dynamic Page Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0F141C]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
