import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isServerDisconnected, setIsServerDisconnected] = useState(false);
  const [showRestoredMessage, setShowRestoredMessage] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pingServer = async () => {
      try {
        const response = await fetch('/api/license/status', { method: 'GET', cache: 'no-store' });
        if (response.ok || response.status < 500) {
          if (isServerDisconnected && isMounted) {
            setIsServerDisconnected(false);
            setShowRestoredMessage(true);
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(() => {
              if (isMounted) setShowRestoredMessage(false);
            }, 4000);
          }
        } else {
          if (isMounted) setIsServerDisconnected(true);
        }
      } catch {
        if (isMounted) setIsServerDisconnected(true);
      }
    };

    // Periodic heartbeat every 15s to check server connection
    intervalId = setInterval(pingServer, 15000);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isServerDisconnected]);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/license/status', { method: 'GET', cache: 'no-store' });
      if (response.ok || response.status < 500) {
        setIsServerDisconnected(false);
        setShowRestoredMessage(true);
        setTimeout(() => {
          setShowRestoredMessage(false);
        }, 4000);
      } else {
        setIsServerDisconnected(true);
      }
    } catch {
      setIsServerDisconnected(true);
    } finally {
      setIsChecking(false);
    }
  };

  if (!isServerDisconnected && !showRestoredMessage) {
    return null;
  }

  return (
    <div className="w-full z-50 transition-all duration-300 print:hidden">
      {/* Offline Alert Banner */}
      {isServerDisconnected && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white px-4 py-2.5 shadow-md flex flex-wrap justify-between items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="bg-white/20 p-1.5 rounded-full shrink-0 animate-pulse">
              <WifiOff className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                <h4 className="font-extrabold text-xs tracking-wide text-white">
                  स्थानिक बँकिंग सर्व्हरशी संपर्क तुटला आहे! (Local Server Disconnected)
                </h4>
              </div>
              <p className="text-[11px] text-rose-100 mt-0.5 leading-tight font-medium">
                स्मार्ट बँकिंग सर्व्हर (Bhisi.Api.exe) बंद असू शकतो किंवा नेटवर्क कनेक्शन तुटले आहे. कृपया सर्व्हर सुरू आहे का ते तपासा.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkConnection}
              disabled={isChecking}
              className="bg-white text-red-700 hover:bg-rose-50 px-3 py-1 rounded-md text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'तपासत आहे...' : 'पुन्हा प्रयत्न करा (Retry)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Restored Connection Toast Notification */}
      {!isServerDisconnected && showRestoredMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 shadow-md flex justify-between items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1 rounded-full">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xs">
              ✅ इंटरनेट कनेक्शन पूर्ववत झाले आहे! (Internet Connection Restored)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowRestoredMessage(false)}
            className="text-white/80 hover:text-white text-xs font-bold px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
