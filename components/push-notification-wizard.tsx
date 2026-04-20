'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellRing, Check, X, Smartphone, Zap, Shield, Clock,
  ChevronRight, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications, type PushStatus } from '@/hooks/use-push-notifications';

/**
 * Push Notification Onboarding Wizard Component
 * Requirements: Requirement 3
 * Design: PushNotificationWizard, WizardStep, PermissionExplainer, PermissionPrompt, SuccessConfirmation
 * 
 * Features:
 * - Multi-step modal (3 steps)
 * - Step 1: Benefits explanation with icons
 * - Step 2: Browser permission prompt
 * - Step 3: Success confirmation with test notification option
 * - Check localStorage for hasSeenPushOnboarding
 * - Show modal on first visit
 * - Skip and Next buttons
 * - Integrate with existing usePushNotifications() hook
 */

interface PushNotificationWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
  autoShow?: boolean; // Show automatically on first visit
}

export function PushNotificationWizard({
  onComplete,
  onSkip,
  autoShow = true
}: PushNotificationWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [showWizard, setShowWizard] = useState(false);
  const { status, toggle, isLoading } = usePushNotifications();

  // Check if user has seen onboarding
  useEffect(() => {
    if (!autoShow) return;

    const hasSeenOnboarding = localStorage.getItem('hasSeenPushOnboarding');
    
    // Only show if:
    // 1. User hasn't seen it before
    // 2. Push notifications are not already active
    // 3. Push notifications are supported
    if (!hasSeenOnboarding && status !== 'active' && status !== 'unsupported') {
      // Delay showing to avoid overwhelming user on first load
      const timer = setTimeout(() => setShowWizard(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [autoShow, status]);

  const handleSkip = () => {
    localStorage.setItem('hasSeenPushOnboarding', 'true');
    setShowWizard(false);
    onSkip?.();
  };

  const handleComplete = () => {
    localStorage.setItem('hasSeenPushOnboarding', 'true');
    setShowWizard(false);
    onComplete?.();
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const handleEnableNotifications = async () => {
    await toggle();
    // Move to success step if permission granted
    if (status === 'active' || status === 'loading') {
      setCurrentStep(3);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      const res = await fetch('/api/test-push');
      if (res.ok) {
        // Success feedback is handled by the API response
      }
    } catch (err) {
      console.error('Failed to send test notification:', err);
    }
  };

  if (!showWizard) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center border border-[#39FF14]/20">
                <BellRing size={20} className="text-[#39FF14]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">24/7 Alerts</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Step {currentStep} of 3
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-slate-950">
            <motion.div
              className="h-full bg-[#39FF14]"
              initial={{ width: '33%' }}
              animate={{ width: `${(currentStep / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <Step1Benefits key="step1" onNext={handleNext} />
              )}
              {currentStep === 2 && (
                <Step2Permission
                  key="step2"
                  onEnable={handleEnableNotifications}
                  status={status}
                  isLoading={isLoading}
                />
              )}
              {currentStep === 3 && (
                <Step3Success
                  key="step3"
                  onComplete={handleComplete}
                  onSendTest={handleSendTestNotification}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 bg-slate-950/30 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-all"
            >
              Skip for now
            </button>
            
            {currentStep < 3 && (
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Next</span>
                <ChevronRight size={14} />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Step 1: Benefits Explanation
 */
function Step1Benefits({ onNext }: { onNext: () => void }) {
  const benefits = [
    {
      icon: Zap,
      title: 'Instant Alerts',
      description: 'Get notified the moment RSI signals trigger, even if the app is closed'
    },
    {
      icon: Smartphone,
      title: 'Wake Your Device',
      description: 'Alerts will wake your phone or computer from sleep mode'
    },
    {
      icon: Clock,
      title: '24/7 Monitoring',
      description: 'Never miss a trading opportunity, day or night'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Notifications are sent directly to your device, no data stored'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h4 className="text-xl font-black text-white mb-2">
          Never Miss a Signal
        </h4>
        <p className="text-sm text-slate-400 leading-relaxed">
          Enable push notifications to receive real-time alerts even when RSIQ Pro is closed.
        </p>
      </div>

      <div className="space-y-3">
        {benefits.map((benefit, idx) => (
          <motion.div
            key={benefit.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
          >
            <div className="w-8 h-8 rounded-lg bg-[#39FF14]/10 flex items-center justify-center shrink-0 border border-[#39FF14]/20">
              <benefit.icon size={16} className="text-[#39FF14]" />
            </div>
            <div>
              <div className="text-sm font-black text-white">{benefit.title}</div>
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                {benefit.description}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full px-6 py-3 rounded-xl bg-[#39FF14] text-slate-950 font-black uppercase tracking-wider hover:bg-[#39FF14]/90 transition-all flex items-center justify-center gap-2"
      >
        <span>Continue</span>
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
}

/**
 * Step 2: Permission Prompt
 */
function Step2Permission({
  onEnable,
  status,
  isLoading
}: {
  onEnable: () => void;
  status: PushStatus;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#39FF14]/10 flex items-center justify-center mx-auto mb-4 border border-[#39FF14]/20">
          <Bell size={32} className="text-[#39FF14]" />
        </div>
        <h4 className="text-xl font-black text-white mb-2">
          Enable Notifications
        </h4>
        <p className="text-sm text-slate-400 leading-relaxed">
          Your browser will ask for permission to send notifications. Click "Allow" to continue.
        </p>
      </div>

      {status === 'denied' && (
        <div className="p-4 rounded-xl bg-[#FF4B5C]/10 border border-[#FF4B5C]/20">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-[#FF4B5C] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-[#FF4B5C] mb-1">
                Permission Denied
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                To enable notifications, please update your browser settings and try again.
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onEnable}
        disabled={isLoading || status === 'active'}
        className={cn(
          "w-full px-6 py-3 rounded-xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
          status === 'active'
            ? "bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 cursor-not-allowed"
            : "bg-[#39FF14] text-slate-950 hover:bg-[#39FF14]/90"
        )}
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Zap size={16} />
            </motion.div>
            <span>Requesting Permission...</span>
          </>
        ) : status === 'active' ? (
          <>
            <Check size={16} />
            <span>Enabled</span>
          </>
        ) : (
          <>
            <Bell size={16} />
            <span>Enable Notifications</span>
          </>
        )}
      </button>
    </motion.div>
  );
}

/**
 * Step 3: Success Confirmation
 */
function Step3Success({
  onComplete,
  onSendTest
}: {
  onComplete: () => void;
  onSendTest: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="w-20 h-20 rounded-2xl bg-[#39FF14]/10 flex items-center justify-center mx-auto mb-4 border border-[#39FF14]/20"
        >
          <Check size={32} className="text-[#39FF14]" />
        </motion.div>
        <h4 className="text-xl font-black text-white mb-2">
          You're All Set!
        </h4>
        <p className="text-sm text-slate-400 leading-relaxed">
          24/7 background alerts are now active. You'll receive notifications even when RSIQ Pro is closed.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
          Test Your Setup
        </div>
        <button
          onClick={onSendTest}
          className="w-full px-4 py-2 rounded-lg bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-all border border-white/10"
        >
          Send Test Notification
        </button>
      </div>

      <button
        onClick={onComplete}
        className="w-full px-6 py-3 rounded-xl bg-[#39FF14] text-slate-950 font-black uppercase tracking-wider hover:bg-[#39FF14]/90 transition-all"
      >
        Start Trading
      </button>
    </motion.div>
  );
}

/**
 * Compact Push Notification Status Display
 * For use in settings panels
 */
interface PushNotificationStatusProps {
  className?: string;
}

export function PushNotificationStatus({ className }: PushNotificationStatusProps) {
  const { status, toggle, isLoading } = usePushNotifications();

  const statusConfig = {
    active: {
      label: 'Active',
      color: 'text-[#39FF14]',
      bg: 'bg-[#39FF14]/10',
      border: 'border-[#39FF14]/30'
    },
    inactive: {
      label: 'Inactive',
      color: 'text-slate-400',
      bg: 'bg-slate-800/30',
      border: 'border-slate-700/30'
    },
    denied: {
      label: 'Denied',
      color: 'text-[#FF4B5C]',
      bg: 'bg-[#FF4B5C]/10',
      border: 'border-[#FF4B5C]/30'
    },
    unsupported: {
      label: 'Unsupported',
      color: 'text-slate-600',
      bg: 'bg-slate-800/30',
      border: 'border-slate-700/30'
    }
  };

  const config = status === 'active' ? statusConfig.active :
                 status === 'denied' ? statusConfig.denied :
                 status === 'unsupported' ? statusConfig.unsupported :
                 statusConfig.inactive;

  return (
    <div className={cn("flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5", className)}>
      <div className="flex items-center gap-3">
        <Bell size={16} className={config.color} />
        <div>
          <div className="text-sm font-black text-white">Push Notifications</div>
          <div className={cn("text-[10px] font-bold uppercase tracking-wider", config.color)}>
            {config.label}
          </div>
        </div>
      </div>
      
      {status !== 'unsupported' && (
        <button
          onClick={toggle}
          disabled={isLoading}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
            config.bg,
            config.color,
            config.border,
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? 'Loading...' : status === 'active' ? 'Disable' : 'Enable'}
        </button>
      )}
    </div>
  );
}
