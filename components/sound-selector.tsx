'use client';

import { memo, useState } from 'react';
import { Volume2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sound Selector Component
 * Requirements: Requirement 8 (Task 6.2)
 * Design: SoundSelector, SoundPreviewButton components
 * 
 * Features:
 * - Dropdown with options: default, soft, urgent, bell, ping
 * - Add "Preview Sound" button
 * - Implement sound playback using existing audio context
 * - Reusable across different contexts
 */

export type AlertSound = 'default' | 'soft' | 'urgent' | 'bell' | 'ping';

interface SoundSelectorProps {
  value: AlertSound;
  onChange: (sound: AlertSound) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  showPreview?: boolean;
}

export const SoundSelector = memo(function SoundSelector({
  value,
  onChange,
  disabled = false,
  className,
  showLabel = true,
  showPreview = true
}: SoundSelectorProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePreview = async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    try {
      await playAlertSound(value);
    } catch (err) {
      console.error('Failed to play sound:', err);
    } finally {
      setTimeout(() => setIsPlaying(false), 1000);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabel && (
        <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 flex items-center gap-1">
          <Volume2 size={10} className="text-blue-400" />
          Sound
        </label>
      )}
      
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as AlertSound)}
          disabled={disabled}
          className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#39FF14]/30 transition-all disabled:opacity-50 cursor-pointer"
        >
          <option value="default">🔔 Default</option>
          <option value="soft">🔕 Soft</option>
          <option value="urgent">⚠️ Urgent</option>
          <option value="bell">🛎️ Bell</option>
          <option value="ping">📍 Ping</option>
        </select>

        {showPreview && (
          <SoundPreviewButton
            sound={value}
            isPlaying={isPlaying}
            onPlay={handlePreview}
            disabled={disabled}
          />
        )}
      </div>

      <div className="p-2 rounded-xl bg-slate-950/30 border border-white/5">
        <p className="text-[8px] text-slate-500 font-bold leading-tight">
          {getSoundDescription(value)}
        </p>
      </div>
    </div>
  );
});

/**
 * Sound Preview Button Component
 * Standalone button for previewing alert sounds
 */

interface SoundPreviewButtonProps {
  sound: AlertSound;
  isPlaying?: boolean;
  onPlay?: () => void;
  disabled?: boolean;
  className?: string;
}

export const SoundPreviewButton = memo(function SoundPreviewButton({
  sound,
  isPlaying = false,
  onPlay,
  disabled = false,
  className
}: SoundPreviewButtonProps) {
  const [localPlaying, setLocalPlaying] = useState(false);

  const handleClick = async () => {
    if (onPlay) {
      onPlay();
    } else {
      setLocalPlaying(true);
      try {
        await playAlertSound(sound);
      } catch (err) {
        console.error('Failed to play sound:', err);
      } finally {
        setTimeout(() => setLocalPlaying(false), 1000);
      }
    }
  };

  const playing = isPlaying || localPlaying;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || playing}
      className={cn(
        "px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-wider hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5",
        className
      )}
      title="Preview sound"
    >
      <Play size={10} className={playing ? "animate-pulse" : ""} />
      <span>{playing ? 'Playing...' : 'Preview'}</span>
    </button>
  );
});

/**
 * Utility Functions
 */

function getSoundDescription(sound: AlertSound): string {
  switch (sound) {
    case 'default':
      return 'Standard notification sound, balanced volume';
    case 'soft':
      return 'Gentle chime, ideal for quiet environments';
    case 'urgent':
      return 'Loud alert tone, demands immediate attention';
    case 'bell':
      return 'Classic bell sound, clear and distinct';
    case 'ping':
      return 'Short ping sound, subtle and quick';
  }
}

/**
 * Play alert sound using Web Audio API
 * This creates simple tones for each sound type
 */
async function playAlertSound(sound: AlertSound): Promise<void> {
  // Check if AudioContext is supported
  if (typeof window === 'undefined' || !window.AudioContext) {
    console.warn('AudioContext not supported');
    return;
  }

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Configure sound based on type
  const config = getSoundConfig(sound);
  
  oscillator.type = config.type;
  oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(config.volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + config.duration);

  // Wait for sound to finish
  return new Promise((resolve) => {
    setTimeout(() => {
      audioContext.close();
      resolve();
    }, config.duration * 1000);
  });
}

function getSoundConfig(sound: AlertSound): {
  type: OscillatorType;
  frequency: number;
  volume: number;
  duration: number;
} {
  switch (sound) {
    case 'default':
      return {
        type: 'sine',
        frequency: 800,
        volume: 0.3,
        duration: 0.3
      };
    case 'soft':
      return {
        type: 'sine',
        frequency: 600,
        volume: 0.15,
        duration: 0.2
      };
    case 'urgent':
      return {
        type: 'square',
        frequency: 1000,
        volume: 0.5,
        duration: 0.5
      };
    case 'bell':
      return {
        type: 'triangle',
        frequency: 900,
        volume: 0.35,
        duration: 0.4
      };
    case 'ping':
      return {
        type: 'sine',
        frequency: 1200,
        volume: 0.25,
        duration: 0.15
      };
  }
}

/**
 * Export utility for getting sound emoji
 */
export function getSoundEmoji(sound: AlertSound): string {
  switch (sound) {
    case 'default': return '🔔';
    case 'soft': return '🔕';
    case 'urgent': return '⚠️';
    case 'bell': return '🛎️';
    case 'ping': return '📍';
  }
}
