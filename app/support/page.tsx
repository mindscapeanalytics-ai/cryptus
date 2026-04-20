"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  MessageCircle, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  ArrowLeft,
  Building2,
  Globe2,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import { MarketTicker } from '@/components/landing/Ticker';
import { LandingHeader } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { cn } from '@/lib/utils';

export default function SupportPage() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      organization: String(formData.get("organization") || ""),
      service: String(formData.get("service") || ""),
      message: String(formData.get("message") || ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      setIsPending(false);
      if (response.ok && result.success) {
        setIsSuccess(true);
        toast.success("MISSION PARAMETERS SENT!", {
          description: "Our AI architects will review your request shortly.",
        });
        const form = e.target as HTMLFormElement;
        form.reset();
      } else {
        toast.error("TRANSMISSION ERROR", {
          description: result.error || "Failed to send connection request.",
        });
      }
    } catch (err) {
      setIsPending(false);
      toast.error("SYSTEM ERROR", {
        description: "A critical failure occurred during transmission.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#05080F] text-slate-300 selection:bg-[#39FF14]/30 selection:text-white overflow-x-hidden font-sans">
      <MarketTicker />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(57,255,20,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(57,255,20,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none z-0" />
      
      <LandingHeader 
        session={session} 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen} 
      />

      <main className="relative z-10 pt-24 sm:pt-32">
        <section className="px-4 sm:px-6 py-12 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 sm:mb-20">
              <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#39FF14] hover:text-white transition-colors mb-8 group">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Back to Terminal
              </Link>
              <div className="max-w-3xl">
                <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-[#39FF14] mb-6">Support & Intelligence</h2>
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tighter leading-[0.95] mb-8">
                  INITIATE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] to-emerald-400">CONNECTION.</span>
                </h1>
                <p className="text-lg sm:text-2xl font-medium text-slate-400 leading-relaxed max-w-2xl">
                  Ready to optimize your institutional infrastructure? Connect with the core engineering team at Mindscape Analytics.
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
              {/* Info Column */}
              <div className="lg:col-span-5 space-y-12">
                <div className="space-y-10">
                  <div className="group flex items-start gap-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#39FF14] transition-all group-hover:bg-[#39FF14] group-hover:text-black">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1 text-lg font-black text-white uppercase tracking-tight">Direct Line</h3>
                      <p className="text-lg font-black text-slate-400">+1-307-210-6155</p>
                      <p className="mt-1 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">WhatsApp & Voice</p>
                    </div>
                  </div>

                  <div className="group flex items-start gap-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#39FF14] transition-all group-hover:bg-[#39FF14] group-hover:text-black">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1 text-lg font-black text-white uppercase tracking-tight">Email Intelligence</h3>
                      <p className="text-lg font-black text-slate-400">info@mindscapeanalytics.com</p>
                      <p className="mt-1 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">General & Technical</p>
                    </div>
                  </div>

                  <div className="group flex items-start gap-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#39FF14] transition-all group-hover:bg-[#39FF14] group-hover:text-black">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1 text-lg font-black text-white uppercase tracking-tight">Headquarters</h3>
                      <p className="text-lg font-black text-slate-400">Sheridan, WY, USA</p>
                      <p className="mt-1 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Mindscape Analytics LLC</p>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 group">
                  <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-[#39FF14] opacity-5 blur-[60px] group-hover:opacity-10 transition-opacity" />
                  <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">Engineering Partner</h3>
                  <p className="text-slate-400 leading-relaxed font-medium mb-6">
                    RSIQ Pro is built and maintained by Mindscape Analytics: A premium engineering firm specializing in AI systems, sales automation, and custom SaaS architecture.
                  </p>
                  <Link href="https://www.mindscapeanalytics.com" target="_blank" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#39FF14] hover:text-white transition-colors group/link">
                    VISIT MINDSCAPEANALYTICS.COM
                    <ChevronRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Form Column */}
              <div className="lg:col-span-7">
                <AnimatePresence mode="wait">
                  {!isSuccess ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="rounded-[3rem] border border-white/10 bg-[#0a0e1b] p-8 sm:p-12 shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#39FF14]/5 blur-[100px] rounded-full pointer-events-none" />
                      <h2 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Protocol Intake</h2>
                      <p className="text-slate-500 font-medium mb-10">Our architects will review and respond within 24 hours.</p>

                      <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">Full Name</label>
                            <input 
                              name="name"
                              required
                              type="text"
                              placeholder="John Wick"
                              className="w-full bg-transparent border-b-2 border-white/10 py-3 text-lg font-bold text-white focus:outline-none focus:border-[#39FF14] transition-colors placeholder:text-slate-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">Work Email</label>
                            <input 
                              name="email"
                              required
                              type="email"
                              placeholder="john@organization.com"
                              className="w-full bg-transparent border-b-2 border-white/10 py-3 text-lg font-bold text-white focus:outline-none focus:border-[#39FF14] transition-colors placeholder:text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">Organization</label>
                            <input 
                              name="organization"
                              required
                              type="text"
                              placeholder="Global Logistics"
                              className="w-full bg-transparent border-b-2 border-white/10 py-3 text-lg font-bold text-white focus:outline-none focus:border-[#39FF14] transition-colors placeholder:text-slate-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">Inquiry Focus</label>
                            <select 
                              name="service"
                              required
                              className="w-full bg-transparent border-b-2 border-white/10 py-3 text-lg font-bold text-white focus:outline-none focus:border-[#39FF14] transition-colors appearance-none"
                            >
                              <option value="" className="bg-[#05080F]">Select Intent...</option>
                              <option value="Advanced Automation" className="bg-[#05080F]">Advanced Automation</option>
                              <option value="SaaS Architecture" className="bg-[#05080F]">SaaS Architecture</option>
                              <option value="AI Implementation" className="bg-[#05080F]">AI Implementation</option>
                              <option value="Technical Support" className="bg-[#05080F]">Technical Support</option>
                              <option value="Partnership" className="bg-[#05080F]">Partnership</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">Mission Requirements</label>
                          <textarea 
                            name="message"
                            required
                            rows={4}
                            placeholder="Describe your architecture requirements..."
                            className="w-full bg-transparent border-b-2 border-white/10 py-3 text-lg font-bold text-white focus:outline-none focus:border-[#39FF14] transition-colors resize-none placeholder:text-slate-800"
                          />
                        </div>

                        <div className="pt-4">
                          <button
                            disabled={isPending}
                            type="submit"
                            className="w-full group flex items-center justify-center gap-3 py-5 bg-[#39FF14] text-black font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-[#39FF14]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:bg-slate-800 disabled:text-slate-500 disabled:scale-100"
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Transmitting...
                              </>
                            ) : (
                              <>
                                Send Parameters
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                              </>
                            )}
                          </button>
                          <p className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            <ShieldCheck size={14} className="text-[#39FF14]" />
                            Secure End-to-End Encryption
                          </p>
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-[3rem] border border-[#39FF14]/20 bg-[#101a12] p-12 sm:p-20 text-center"
                    >
                      <div className="mx-auto w-24 h-24 bg-[#39FF14] rounded-3xl flex items-center justify-center text-black mb-10 shadow-2xl shadow-[#39FF14]/20">
                        <CheckCircle2 size={48} />
                      </div>
                      <h2 className="text-4xl font-black text-white mb-4 tracking-tight uppercase">Transmission Received</h2>
                      <p className="text-slate-300 text-lg font-medium max-w-sm mx-auto mb-10 leading-relaxed">
                        Your inquiry has been successfully received by the Mindscape core. Our architects are now prioritizing your request.
                      </p>
                      <button 
                        onClick={() => setIsSuccess(false)}
                        className="text-[11px] font-black uppercase tracking-[0.3em] text-[#39FF14] hover:text-white transition-colors"
                      >
                        Send Another Signal
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* Global Stats */}
        <section className="py-24 border-t border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
              <div>
                <p className="text-4xl font-black text-[#39FF14] mb-2 leading-none">24/7</p>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Active Monitoring</p>
              </div>
              <div>
                <p className="text-4xl font-black text-[#39FF14] mb-2 leading-none">99.9%</p>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Uptime SLA</p>
              </div>
              <div>
                <p className="text-4xl font-black text-[#39FF14] mb-2 leading-none">128ms</p>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Core Response</p>
              </div>
              <div>
                <p className="text-4xl font-black text-[#39FF14] mb-2 leading-none">40+</p>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Market coverage</p>
              </div>
            </div>
            <div className="mt-20 flex justify-center opacity-20">
              <Globe2 size={60} className="text-slate-400" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
