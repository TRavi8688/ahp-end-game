import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopAppBar } from './TopAppBar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans selection:bg-primary/30">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full relative">
        <TopAppBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full animate-in fade-in duration-300">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
};
