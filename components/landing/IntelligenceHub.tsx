"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Activity, Brain } from 'lucide-react';
import { IntelligenceCard, SignalPreview, GridBackground } from './LandingUI';

export function IntelligenceHub() {
  return (
    <section className="py-24 sm:py-32 bg-[#05080F] border-y border-white/5 relative overflow-hidden">
      <GridBackground className="opacity-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-24">
          <h2 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.5em] text-[#39FF14] mb-4">Situational Awareness</h2>
          <p className="text-4xl sm:text-6xl font-black text-white tracking-tighter uppercase leading-[0.9]">
            Global Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] to-emerald-400">Surveillance.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Module 1: Smart Money & Liquidation Flux */}
          <IntelligenceCard
            icon={<ShieldCheck className="text-[#39FF14]" />}
            subtitle="Orderbook Intelligence"
            title="Smart Money & Liquidation Flux"
            delay={0.1}
          >
            <div className="space-y-6 mt-6">
              <p className="text-sm text-slate-400 leading-relaxed">
                Intercept institutional margin exhaustion and whale cluster movements instantly. Intercept the footprints of capital before they hit the chart.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h4 className="text-[10px] font-black text-[#39FF14] uppercase tracking-widest mb-1">Smart Money Index</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Track aggregate institutional accumulation in real-time.</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Liquidation Flux V4</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Identify high-probability reversal zones driven by forced liquidations.</p>
                </div>
              </div>
            </div>
          </IntelligenceCard>

          {/* Module 2: The Signal Narration Engine */}
          <IntelligenceCard
            icon={<Brain className="text-emerald-400" />}
            subtitle="Linguistic Intelligence"
            title="The Signal Narration Engine™"
            delay={0.2}
          >
            <div className="space-y-6 mt-6">
              <p className="text-sm text-slate-400 leading-relaxed">
                Moving beyond raw data into verified, institutional-grade intelligence. Automated pattern narration for instant decision scaling.
              </p>
              <SignalPreview 
                type="buy"
                title="STRONG BUY"
                subtitle="RSI oversold at 22.4 with bullish divergence"
                bullets={[
                  "MACD crossed bullish",
                  "EMA9 > EMA21",
                  "Whale accumulation detected"
                ]}
              />
              <div className="flex gap-4">
                <div className="flex-1 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Win Rate</span>
                  <span className="text-sm font-black text-[#39FF14]">73% (last 30d)</span>
                </div>
                <div className="flex-1 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Ecosystem</span>
                  <span className="text-sm font-black text-white">X / Discord / TG</span>
                </div>
              </div>
            </div>
          </IntelligenceCard>

          {/* Module 3: Portfolio Armor */}
          <IntelligenceCard
            icon={<Activity className="text-amber-400" />}
            subtitle="Risk Management"
            title="Portfolio Armor & Risk Guardrails"
            delay={0.3}
          >
            <div className="space-y-6 mt-6">
              <p className="text-sm text-slate-400 leading-relaxed">
                Mathematical intervention to protect enterprise assets during volatility cascades. An adaptive copilot that monitors execution psychology.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10 group/item">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Neural HHI Scoring</span>
                    <span className="text-[9px] text-slate-500 font-medium">Market concentration monitoring.</span>
                  </div>
                  <span className="text-[10px] font-black text-[#39FF14] bg-[#39FF14]/10 py-1 px-2 rounded">LOW RISK</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10 group/item">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Aggregate RSI</span>
                    <span className="text-[9px] text-slate-500 font-medium">Real-time momentum analysis.</span>
                  </div>
                  <span className="text-[10px] font-black text-white">54.5</span>
                </div>
              </div>
            </div>
          </IntelligenceCard>

          {/* Module 4: Institutional Execution */}
          <IntelligenceCard
            icon={<Zap className="text-blue-400" />}
            subtitle="Performance"
            title="Institutional Execution Lead"
            delay={0.4}
          >
            <div className="space-y-6 mt-6">
              <p className="text-sm text-slate-400 leading-relaxed">
                Engineered for high-frequency analytical workloads. ALE-v4 prioritizes 0.5ms data fidelity during extreme market cascades.
              </p>
              <div className="p-6 rounded-2xl bg-[#39FF14]/5 border border-[#39FF14]/10 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-[#39FF14] uppercase tracking-widest">Terminal Latency</span>
                  <span className="text-xl font-black text-white tracking-tighter">0.5ms</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: '92%' }}
                    transition={{ duration: 1.5 }}
                    className="h-full bg-[#39FF14]" 
                  />
                </div>
              </div>
              <button className="w-full py-4 rounded-xl bg-[#39FF14] text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-[#39FF14]/10">
                Unlock Edge Control
              </button>
            </div>
          </IntelligenceCard>
        </div>
      </div>
    </section>
  );
}
