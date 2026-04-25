'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, ExternalLink } from 'lucide-react';
import TradingViewWidget from './trading-view-widget';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  market?: string;
  interval?: string;
}

/**
 * Full-screen institutional chart modal
 */
export function ChartModal({
  isOpen,
  onClose,
  symbol,
  market = 'Crypto',
  interval = '15'
}: ChartModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60]"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 md:inset-6 lg:inset-8 bg-[#0A0D14] border-x border-y md:border border-white/10 md:rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0D111A]">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#39FF14]/10 rounded-lg">
                  <Maximize2 size={18} className="text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight leading-none uppercase">
                    {symbol} <span className="text-[#39FF14]">Live Analysis</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Institutional Alpha Stream • {interval}M Timeframe
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                 <a 
                    href={`https://www.tradingview.com/chart/?symbol=${market === 'Crypto' ? 'BINANCE:' : ''}${symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
                    title="Open in TradingView"
                 >
                    <ExternalLink size={20} />
                 </a>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
                >
                  <X size={24} className="text-slate-400 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>

            {/* Widget Body */}
            <div className="flex-1 w-full bg-[#0A0D14] relative overflow-hidden flex flex-col">
              <TradingViewWidget 
                symbol={symbol} 
                market={market} 
                interval={interval}
              />
            </div>
            
            {/* Minimal Footer */}
            <div className="px-6 py-2 bg-[#0D111A] border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    Alpha Terminal • Reality Check Enabled
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    {new Date().toUTCString()}
                </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
