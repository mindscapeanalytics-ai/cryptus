'use client';
import Link from 'next/link';
import { Search, Home, ChevronLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full rounded-3xl border border-white/5 bg-[#0d121f] p-8 text-center shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#39FF14]/[0.02] rounded-full -mr-16 -mt-16 group-hover:bg-[#39FF14]/[0.05] transition-colors duration-1000" />
        
        <div className="w-16 h-16 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/20 flex items-center justify-center mx-auto mb-6">
          <Search className="text-[#39FF14]" size={32} />
        </div>

        <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">404</h1>
        <h2 className="text-xl font-bold text-slate-200 mb-4 uppercase tracking-widest text-[12px]">Signal Lost</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          The pair or page you are looking for has been delisted or moved to a new route. Please check your URL or return to the terminal.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#39FF14] text-black font-black text-sm hover:bg-[#32e012] transition-colors active:scale-95 shadow-[0_0_20px_rgba(57,255,20,0.1)]"
          >
            <Home size={16} />
            Back to Dashboard
          </Link>
          
          <button
            onClick={() => typeof window !== 'undefined' && window.history.back()}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-white/5 text-slate-400 font-bold text-sm hover:bg-white/10 border border-white/5 transition-colors active:scale-95"
          >
            <ChevronLeft size={16} />
            Previous Session
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Mindscape Analytics LLC</span>
        </div>
      </div>
    </div>
  );
}
