"use client";

import React, { useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, ShieldCheck, Terminal } from "lucide-react";
import { motion } from "framer-motion";

function VerifySuccessContent() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch login and terminal
    router.prefetch("/login");
    router.prefetch("/terminal");
    
    // Auto-redirect to login after 5 seconds
    const timer = setTimeout(() => {
      router.push("/login");
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#05080F] flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#39FF14]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group mb-16 transition-transform hover:scale-[1.02]">
             <div className="relative w-12 h-12 overflow-hidden rounded-xl border border-[#39FF14]/20 shadow-lg shadow-[#39FF14]/10 bg-gradient-to-br from-[#39FF14]/10 to-transparent">
                <Image 
                  src="/logo/rsiq-mindscapeanalytics.png" 
                  alt="RSIQ Pro" 
                  fill
                  priority
                  className="object-cover scale-110"
                />
             </div>
             <div className="flex flex-col text-left">
               <span className="text-2xl font-black text-white tracking-tighter leading-none">RSIQ <span className="text-[#39FF14]">PRO</span></span>
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 leading-none mt-1.5">Verification Service</span>
             </div>
          </Link>

          {/* Success Icon with Glow */}
          <div className="relative mb-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 12 }}
              className="w-24 h-24 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center relative z-10"
            >
              <CheckCircle2 size={48} className="text-[#39FF14]" />
            </motion.div>
            <div className="absolute inset-0 bg-[#39FF14]/20 blur-2xl rounded-full scale-110" />
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-4 selection:bg-[#39FF14] selection:text-black">
            Operator Verified
          </h1>
          
          <p className="text-slate-400 text-lg font-medium max-w-[320px] leading-relaxed mb-12">
            Your connection has been authenticated. Terminal access is now authorized.
          </p>

          <div className="flex flex-col w-full gap-4">
            <Link 
              href="/login"
              className="w-full h-14 bg-[#39FF14] hover:bg-[#32e012] text-black text-sm font-black uppercase tracking-[0.15em] rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-[#39FF14]/10"
            >
              Access Terminal
              <ArrowRight size={18} />
            </Link>
            
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mt-4">
              Auto-redirecting to login in <span className="text-slate-400">5 seconds</span>...
            </p>
          </div>
        </div>
      </motion.div>

      {/* Security Footer Details */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-8 opacity-20 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#39FF14]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">SSL Encrypted</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#39FF14]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">AuthNode 01</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifySuccessPage() {
  return (
    <Suspense fallback={null}>
      <VerifySuccessContent />
    </Suspense>
  );
}
