'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronLeft, Zap, Smartphone, ShieldCheck, Activity, Cpu, Globe, ArrowUpRight, Star } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { motion } from 'framer-motion';

export function HeroCTAs() {
  const { data: session } = useSession();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-center">
      {/* Left HUD Stats */}
      <div className="hidden md:flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={14} className="text-[#39FF14]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Engine Latency</span>
          </div>
          <div className="text-xl font-black text-white">0.5ms</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-[#39FF14]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Ticks / Day</span>
          </div>
          <div className="text-xl font-black text-white text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">2.4B+</div>
        </div>
      </div>

      {/* Main CTAs */}
      <div className="flex flex-col gap-4">
        <Link
          href={session ? "/terminal" : "/register"}
          className="w-full px-8 py-5 sm:py-7 rounded-2xl bg-[#39FF14] text-black font-black uppercase tracking-[0.25em] shadow-[0_20px_60px_rgba(57,255,20,0.3)] hover:shadow-[0_20px_80px_rgba(57,255,20,0.5)] transition-all text-[12px] sm:text-[14px] active:scale-95 text-center group"
        >
          {session ? "Enter Terminal" : "Launch Terminal"}
          <ChevronRight size={18} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href={session ? "/terminal" : "/login"}
          className="w-full text-center px-8 py-4 rounded-2xl border border-white/10 bg-white/[0.02] text-slate-300 font-black uppercase tracking-[0.2em] text-[11px] active:scale-95 transition-all backdrop-blur-sm"
        >
          {session ? "Return to Desk" : "Sign In to Desk"}
        </Link>
      </div>

      {/* Right HUD Stats */}
      <div className="hidden md:flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={14} className="text-[#39FF14]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Active Symbols</span>
          </div>
          <div className="text-xl font-black text-white">580+</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-[#39FF14]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Security Grade</span>
          </div>
          <div className="text-xl font-black text-white">ENTERPRISE</div>
        </div>
      </div>
    </div>
  );
}

export function FloatingElement({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function HeroHeading() {
    return (
        <div className="flex flex-col items-center">
            <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[2.8rem] sm:text-6xl md:text-8xl lg:text-9xl font-black text-center text-white tracking-tighter leading-[1.05] sm:leading-[0.85] mb-4 drop-shadow-2xl relative z-10"
            >
                THE ALPHA <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] to-emerald-400 uppercase">Terminal.</span>
            </motion.h1>

            <h2 className="text-[9px] sm:text-xs md:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.6em] text-[#39FF14] mb-10 sm:mb-16 text-center px-4">Institutional Speed for Professional Signal Execution</h2>
        </div>
    );
}
