"use client";

import React from 'react';
import { GridBackground, OutcomeLabel } from './LandingUI';
import { cn } from '@/lib/utils';

interface MatrixPointProps {
  text: string;
  type: 'retail' | 'alpha';
}

function MatrixPoint({ text, type }: MatrixPointProps) {
  return (
    <div className={cn(
      "p-4 sm:p-5 border rounded-sm mb-4 last:mb-0 transition-all duration-300",
      type === 'retail' 
        ? "bg-red-500/5 border-red-500/20 text-slate-400 group-hover:border-red-500/40" 
        : "bg-[#39FF14]/5 border-[#39FF14]/20 text-slate-200 group-hover:border-[#39FF14]/40"
    )}>
      <p className="text-xs sm:text-sm font-medium leading-relaxed">
        {text}
      </p>
    </div>
  );
}

export function ProfitGap() {
  const retailPoints = [
    "60-second delay waiting for candle closure",
    "Manual chart flipping across 10+ tabs",
    "Guessing signal strength with zero backtest data",
    "Analysis paralysis during high volatility"
  ];

  const alphaPoints = [
    "500+ symbols scanned autonomously every tick",
    "Real-time lead alerts before retail closes candles",
    "Instantly verified confluence win-rate tracking",
    "Institutional Whale volume & Liquidation flux overlay"
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 relative overflow-hidden bg-[#05080F]">
      <GridBackground className="opacity-20" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 sm:mb-24 space-y-4">
          <h2 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.5em] text-slate-500">Diagnostic Matrix</h2>
          <p className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase">
            Legacy Friction vs. <span className="text-[#39FF14]">Modern Speed.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/5 border border-white/5 overflow-hidden">
          {/* Retail Column */}
          <div className="relative bg-[#05080f] p-8 sm:p-12 flex flex-col group">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600/80" />
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-12 text-center uppercase">The Retail Friction</h3>
              <div className="space-y-4 max-w-lg mx-auto">
                {retailPoints.map((p, i) => (
                  <MatrixPoint key={i} text={p} type="retail" />
                ))}
              </div>
            </div>
            <div className="mt-12 -mx-8 sm:-mx-12 -mb-8 sm:-mb-12">
              <OutcomeLabel text="Silent Setups Missed." type="retail" />
            </div>
          </div>

          {/* Alpha Pro Column */}
          <div className="relative bg-[#05080f] p-8 sm:p-12 flex flex-col group">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#39FF14]/80" />
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-12 text-center uppercase">The Alpha Pro Edge</h3>
              <div className="space-y-4 max-w-lg mx-auto">
                {alphaPoints.map((p, i) => (
                  <MatrixPoint key={i} text={p} type="alpha" />
                ))}
              </div>
            </div>
            <div className="mt-12 -mx-8 sm:-mx-12 -mb-8 sm:-mb-12">
              <OutcomeLabel text="+14.2% Total Alpha Scored." type="alpha" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
