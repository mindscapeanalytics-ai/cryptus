'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[Root Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full rounded-3xl border border-white/5 bg-[#0d121f] p-8 text-center shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/20 via-red-500 to-red-500/20" />
        
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-red-500" size={32} />
        </div>

        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">System Interrupted</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          An unexpected error occurred while processing your request. Our automated systems have been notified.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#39FF14] text-black font-black text-sm hover:bg-[#32e012] transition-colors active:scale-95"
          >
            <RefreshCcw size={16} />
            Try Recovery
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-white/5 text-slate-300 font-bold text-sm hover:bg-white/10 border border-white/5 transition-colors active:scale-95"
          >
            <Home size={16} />
            Return Home
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 leading-none">Reference ID</div>
          <div className="text-[10px] font-mono text-slate-500 tabular-nums">
            {error.digest || 'ERR_UNKNOWN_STATE'}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
