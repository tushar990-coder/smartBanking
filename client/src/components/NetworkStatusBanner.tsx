import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../utils/api';

export default function NetworkStatusBanner() {
  const [isServerDisconnected, setIsServerDisconnected] = useState(false);
  const [showRestoredMessage, setShowRestoredMessage] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const consecutiveFailuresRef = useRef<number>(0);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pingServer = async () => {
      // 1. If browser is explicitly offline (airplane mode, cable unplugged)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        consecutiveFailuresRef.current = 3;
        if (isMounted) setIsServerDisconnected(true);
        return;
      }

      // 2. Perform heartbeat check via configured API client
      try {
        const res = await api.get('/license/status', { timeout: 7000 });
        if (res.status < 500) {
          consecutiveFailuresRef.current = 0;
          if (isMounted && isServerDisconnected) {
            setIsServerDisconnected(false);
            setShowRestoredMessage(true);
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(() => {
              if (isMounted) setShowRestoredMessage(false);
            }, 4000);
          }
          return;
        }
      } catch {
        // Fallback relative ping check in case of base URL routing variations
        try {
          const fallback = await fetch('/api/license/status', { cache: 'no-store' });
          if (fallback.ok || fallback.status < 500) {
            consecutiveFailuresRef.current = 0;
            if (isMounted && isServerDisconnected) {
              setIsServerDisconnected(false);
              setShowRestoredMessage(true);
              if (timerId) clearTimeout(timerId);
              timerId = setTimeout(() => {
                if (isMounted) setShowRestoredMessage(false);
              }, 4000);
            }
            return;
          }
        } catch {}
      }

      // 3. Only trigger disconnect alert after 3 consecutive failed checks (prevents momentary false alarms)
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3 && isMounted) {
        setIsServerDisconnected(true);
      }
    };

    // Periodic heartbeat every 45s (battery friendly and prevents cloud server overload)
    intervalId = setInterval(pingServer, 45000);

    const handleOffline = () => {
      consecutiveFailuresRef.current = 3;
      if (isMounted) setIsServerDisconnected(true);
    };

    const handleOnline = () => {
      pingServer();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isServerDisconnected]);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const res = await api.get('/license/status', { timeout: 7000 });
      if (res.status < 500) {
        consecutiveFailuresRef.current = 0;
        setIsServerDisconnected(false);
        setShowRestoredMessage(true);
        setTimeout(() => setShowRestoredMessage(false), 4000);
        return;
      }
    } catch {
      try {
        const fallback = await fetch('/api/license/status', { cache: 'no-store' });
        if (fallback.ok || fallback.status < 500) {
          consecutiveFailuresRef.current = 0;
          setIsServerDisconnected(false);
          setShowRestoredMessage(true);
          setTimeout(() => setShowRestoredMessage(false), 4000);
          return;
        }
      } catch {}
    } finally {
      setIsChecking(false);
    }
    // If explicit retry failed
    setIsServerDisconnected(true);
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
                  बँकिंग सर्व्हरशी संपर्क तुटला आहे (Banking Server Disconnected)
                </h4>
              </div>
              <p className="text-[11px] text-rose-100 mt-0.5 leading-tight font-medium">
                सर्व्हरकडून प्रतिसाद मिळत नाही किंवा इंटरनेट कनेक्शन मंद/तुटले आहे. कृपया तुमचे नेटवर्क कनेक्शन तपासा.
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
              ✅ सर्व्हर व इंटरनेट कनेक्शन पूर्ववत झाले आहे! (Connection Restored)
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
