"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, Zap, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentSentinelProps {
  isOpen: boolean;
  onClose: () => void;
  plan: string;
}

export function PaymentSentinel({ isOpen, onClose, plan }: PaymentSentinelProps) {
  const [step, setStep] = useState<"initializing" | "ready" | "verifying">("initializing");

  useEffect(() => {
    if (isOpen) {
      // Simulate institutional network handshake
      const timer = setTimeout(() => {
        setStep("ready");
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setStep("initializing");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-[#0a0f1a] p-8 shadow-2xl overflow-hidden"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -right-24 h-48 w-48 bg-[#39FF14]/10 blur-[80px]" />
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 text-center">
            {step === "initializing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key="initializing"
              >
                <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-[#39FF14] animate-spin" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Securing Gateway</h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  Establishing a secure link with <span className="text-white font-bold">NOWPayments</span> institutional nodes...
                </p>
                
                <div className="mt-8 flex justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <img src="https://nowpayments.io/images/coins/usdt_bsc.svg" className="h-10 w-10 grayscale hover:grayscale-0 transition" alt="USDT" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">USDT (BSC)</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <img src="https://nowpayments.io/images/coins/sol.svg" className="h-10 w-10 grayscale hover:grayscale-0 transition" alt="SOL" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">SOL (SOL)</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <img src="https://nowpayments.io/images/coins/usdc.svg" className="h-10 w-10 grayscale hover:grayscale-0 transition" alt="USDC" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">USDC (SOLANA)</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "ready" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key="ready"
              >
                <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Invoice Ready</h3>
                <p className="mt-3 text-sm text-slate-400">
                  Your secure {plan} checkout session is ready. You will be redirected to the official payment portal.
                </p>
                
                <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/5 text-left">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Provider</span>
                    <span>Service</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm font-bold text-slate-200">
                    <span>NOWPayments</span>
                    <span>RSIQ PRO</span>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-black text-[#39FF14] uppercase tracking-[0.2em] animate-pulse">
                  <Zap className="h-3 w-3 fill-current" /> Auto-Activation Enabled
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
