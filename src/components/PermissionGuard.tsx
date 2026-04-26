import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Bell, ShieldCheck, ArrowRight } from 'lucide-react';

interface PermissionGuardProps {
  onPermissionsGranted: () => void;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ onPermissionsGranted }) => {
  const [step, setStep] = useState<'intro' | 'location' | 'notifications'>('intro');
  const [complete, setComplete] = useState(false);

  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      () => {
        setStep('notifications');
      },
      () => {
        // Even if denied, move to next or show fallback
        setStep('notifications');
      }
    );
  };

  const requestNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(() => {
        setComplete(true);
        setTimeout(onPermissionsGranted, 800);
      });
    } else {
      setComplete(true);
      setTimeout(onPermissionsGranted, 800);
    }
  };

  if (complete) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl space-y-8"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-sky-600 rounded-3xl flex items-center justify-center shadow-lg shadow-sky-900/40">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center space-y-4"
            >
              <h2 className="text-2xl font-bold tracking-tight">Security & Access</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                To provide precise weather intelligence and critical safety alerts, Aura requires specific system permissions. We follow Google's privacy protocols to ensure your data is processed locally.
              </p>
              <button 
                onClick={() => setStep('location')}
                className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all transition-transform active:scale-95"
              >
                Begin Setup <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 'location' && (
            <motion.div 
              key="location"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center space-y-4"
            >
              <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-sky-400" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Location Services</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Aura uses hyper-local coordinates to detect lightning strikes and approaching storm cells within a 1-mile radius of your position.
              </p>
              <button 
                onClick={requestLocation}
                className="w-full py-4 bg-zinc-100 text-black rounded-2xl font-bold transition-all transition-transform active:scale-95"
              >
                Grant Location Access
              </button>
              <button 
                onClick={() => setStep('notifications')}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            </motion.div>
          )}

          {step === 'notifications' && (
            <motion.div 
              key="notifications"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center space-y-4"
            >
              <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Safety Notifications</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Get immediate alerts for severe lightning, extreme precipitation, and secondary hazards even when the application is in the background.
              </p>
              <button 
                onClick={requestNotifications}
                className="w-full py-4 bg-zinc-100 text-black rounded-2xl font-bold transition-all transition-transform active:scale-95"
              >
                Enable Alerts
              </button>
              <button 
                onClick={() => { setComplete(true); onPermissionsGranted(); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", step === 'intro' ? 'bg-sky-500' : 'bg-zinc-800')} />
          <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", step === 'location' ? 'bg-sky-500' : 'bg-zinc-800')} />
          <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", step === 'notifications' ? 'bg-sky-500' : 'bg-zinc-800')} />
        </div>
      </motion.div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
