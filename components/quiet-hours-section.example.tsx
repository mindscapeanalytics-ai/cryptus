/**
 * Usage Example for QuietHoursSection Component
 * 
 * This file demonstrates how to integrate the QuietHoursSection component
 * into the CoinSettingsModal or any other configuration interface.
 */

import { QuietHoursSection } from './quiet-hours-section';

// Example 1: Basic usage in a settings modal
function ExampleSettingsModal() {
  const [config, setConfig] = useState({
    quietHoursEnabled: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
  });

  return (
    <div className="space-y-4">
      {/* Other settings... */}
      
      <QuietHoursSection
        enabled={config.quietHoursEnabled}
        startHour={config.quietHoursStart}
        endHour={config.quietHoursEnd}
        onEnabledChange={(enabled) => 
          setConfig({ ...config, quietHoursEnabled: enabled })
        }
        onStartHourChange={(hour) => 
          setConfig({ ...config, quietHoursStart: hour })
        }
        onEndHourChange={(hour) => 
          setConfig({ ...config, quietHoursEnd: hour })
        }
      />
      
      {/* Other settings... */}
    </div>
  );
}

// Example 2: Integration with existing CoinSettingsModal
// Replace the existing quiet hours section in screener-dashboard.tsx (around line 5625)
// with this component:

/*
  OLD CODE (to be replaced):
  
  <div className="space-y-2">
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 group">
      <div className="flex flex-col">
        <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
          <Clock size={11} />
          Quiet Hours
        </span>
        <span className="text-[7px] text-slate-500 font-bold uppercase mt-0.5 leading-tight pr-4">
          Suppress low/medium priority alerts
        </span>
      </div>
      <button
        onClick={() => setConfig({ ...config, quietHoursEnabled: !config.quietHoursEnabled })}
        disabled={loading}
        className={cn(
          "w-9 h-4.5 rounded-full p-0.5 transition-all flex items-center",
          config.quietHoursEnabled ? "bg-purple-500" : "bg-slate-800"
        )}
      >
        <div className={cn(
          "w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
          config.quietHoursEnabled ? "translate-x-4.5" : "translate-x-0"
        )} />
      </button>
    </div>

    {config.quietHoursEnabled && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="grid grid-cols-2 gap-2"
      >
        <div className="space-y-1.5">
          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">Start (24h)</span>
          <select
            value={config.quietHoursStart}
            onChange={(e) => setConfig({ ...config, quietHoursStart: parseInt(e.target.value) })}
            disabled={loading}
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500/30 transition-all disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">End (24h)</span>
          <select
            value={config.quietHoursEnd}
            onChange={(e) => setConfig({ ...config, quietHoursEnd: parseInt(e.target.value) })}
            disabled={loading}
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500/30 transition-all disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
      </motion.div>
    )}
  </div>

  NEW CODE (replacement):
  
  <QuietHoursSection
    enabled={config.quietHoursEnabled}
    startHour={config.quietHoursStart}
    endHour={config.quietHoursEnd}
    onEnabledChange={(enabled) => 
      setConfig({ ...config, quietHoursEnabled: enabled })
    }
    onStartHourChange={(hour) => 
      setConfig({ ...config, quietHoursStart: hour })
    }
    onEndHourChange={(hour) => 
      setConfig({ ...config, quietHoursEnd: hour })
    }
    disabled={loading}
  />
*/

// Example 3: Standalone usage with custom styling
function ExampleStandaloneUsage() {
  const [enabled, setEnabled] = useState(false);
  const [startHour, setStartHour] = useState(22);
  const [endHour, setEndHour] = useState(8);

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Configure Quiet Hours</h2>
      
      <QuietHoursSection
        enabled={enabled}
        startHour={startHour}
        endHour={endHour}
        onEnabledChange={setEnabled}
        onStartHourChange={setStartHour}
        onEndHourChange={setEndHour}
        className="my-custom-class"
      />
    </div>
  );
}

// Example 4: Integration with form validation
function ExampleWithValidation() {
  const [config, setConfig] = useState({
    quietHoursEnabled: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
  });

  const handleSave = async () => {
    // Validate configuration
    if (config.quietHoursEnabled) {
      if (config.quietHoursStart < 0 || config.quietHoursStart > 23) {
        console.error('Invalid start hour');
        return;
      }
      if (config.quietHoursEnd < 0 || config.quietHoursEnd > 23) {
        console.error('Invalid end hour');
        return;
      }
    }

    // Save to backend
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'BTCUSDT',
        quietHoursEnabled: config.quietHoursEnabled,
        quietHoursStart: config.quietHoursStart,
        quietHoursEnd: config.quietHoursEnd,
      }),
    });

    if (response.ok) {
      console.log('Configuration saved successfully');
    }
  };

  return (
    <div>
      <QuietHoursSection
        enabled={config.quietHoursEnabled}
        startHour={config.quietHoursStart}
        endHour={config.quietHoursEnd}
        onEnabledChange={(enabled) => 
          setConfig({ ...config, quietHoursEnabled: enabled })
        }
        onStartHourChange={(hour) => 
          setConfig({ ...config, quietHoursStart: hour })
        }
        onEndHourChange={(hour) => 
          setConfig({ ...config, quietHoursEnd: hour })
        }
      />
      
      <button onClick={handleSave} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        Save Configuration
      </button>
    </div>
  );
}
