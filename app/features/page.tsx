"use client";

import React from 'react';
import { useSession } from '@/lib/auth-client';
import { LandingHeader } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { GridBackground } from '@/components/landing/LandingUI';
import { ProfitGap } from '@/components/landing/ProfitGap';
import { LogicSection } from '@/components/landing/LogicSection';
import { IntelligenceHub } from '@/components/landing/IntelligenceHub';
import { Roadmap } from '@/components/landing/Roadmap';
import { Services } from '@/components/landing/Services';
import { MobileExperience } from '@/components/landing/MobileExperience';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';

export default function FeaturesPage() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#05080F] text-slate-300 selection:bg-[#39FF14]/30 selection:text-white overflow-x-hidden font-sans">
      <LandingHeader 
        session={session} 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen} 
      />

      <main className="relative z-10 pt-20">
        {/* ─── Product Hero ─── */}
        <section className="py-24 sm:py-32 md:py-40 relative overflow-hidden border-b border-white/5">
          <GridBackground className="opacity-20" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/5 mb-8">
              <Star size={14} className="text-[#39FF14] fill-[#39FF14]" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#39FF14]">The Sovereign Trading Standard</span>
            </div>
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter uppercase leading-[0.85]">
              Beyond <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] to-emerald-400">Raw Data.</span>
            </h1>
            <p className="mt-8 text-slate-400 text-lg sm:text-xl font-medium max-w-3xl mx-auto leading-relaxed">
              RSIQ Pro isn't just a scanner. It's an institutional-grade decision factory that converts market entropy into actionable high-probability setups in sub-milliseconds.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/register" className="px-10 py-5 rounded-2xl bg-[#39FF14] text-black font-black uppercase text-[13px] tracking-widest shadow-2xl shadow-[#39FF14]/20 hover:scale-[1.05] transition-all">
                Start 14-Day Free Trial
              </Link>
              <Link href="/login" className="text-white font-black uppercase text-[11px] tracking-widest hover:text-[#39FF14] transition-colors flex items-center gap-2">
                Live Terminal Demo <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Capabilities Tour ─── */}
        <div className="space-y-0">
          <ProfitGap />
          <LogicSection />
          <IntelligenceHub />
          <MobileExperience />
          <Roadmap />
          <Services />
        </div>

        {/* ─── Final CTA ─── */}
        <section className="py-24 sm:py-32 bg-white relative overflow-hidden text-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
             <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase leading-none mb-8">
                Ready to reclaim your <br />
                <span className="text-blue-600">Cognitive Edge?</span>
             </h2>
             <p className="text-slate-600 text-lg font-medium max-w-2xl mx-auto leading-relaxed mb-12">
                Join 2,400+ professional traders using the RSIQ Pro ecosystem to front-run retail lag and capture institutional alpha every single tick.
             </p>
             <Link href="/register" className="px-12 py-6 rounded-2xl bg-black text-white font-black uppercase text-[14px] tracking-[0.2em] shadow-2xl hover:scale-105 transition-all inline-block">
                Authorize Your Terminal Access
             </Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
