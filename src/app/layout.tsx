import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Film, Sparkles, BookOpen, Layers, Sliders, Cpu } from 'lucide-react';

export const metadata: Metadata = {
  title: 'OpenStory Studio — Cinematic Hindi AI Video Production',
  description: 'Local-first cinematic animated Hindi story video creation suite with strict character consistency and multi-model pipeline.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20 transition-all">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                      OpenStory
                    </span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      STUDIO
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                    LOCAL HINDI ANIMATION SUITE
                  </p>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-4 h-4 text-slate-400" />
                  Projects
                </Link>
                <Link
                  href="/projects/new"
                  className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Import / New
                </Link>
                <Link
                  href="/lab"
                  className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Model Lab
                </Link>
                <Link
                  href="/settings"
                  className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Settings
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Local SQLite Ready
              </span>
              <Link
                href="/projects/new"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-sm flex items-center gap-1.5"
              >
                + New Project
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6">{children}</main>

        <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500 font-mono">
          OpenStory Studio v1.0.0 • Local-First Filmmaking Architecture • SQLite & Filesystem Media
        </footer>
      </body>
    </html>
  );
}
