import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthUser {
  token: string;
  username: string;
  role: string;
  branchID: number;
  branchName: string;
  financialYearID: number;
  financialYearCode: string;
  businessDate: string;
  requirePasswordChange: boolean;
  userID?: number;
  roleName?: string;
  branchType?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  globalBranchId: string | null;
  login: (userData: AuthUser) => void;
  logout: () => void;
  switchBranch: (branchID: number, branchName: string) => Promise<boolean>;
  markPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Purge legacy permanent localStorage token to enforce session expiration on browser close
    localStorage.removeItem('bhisi_user');

    const savedUser = sessionStorage.getItem('bhisi_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && (parsed.token || parsed.username)) {
          if (parsed?.branchID) {
            sessionStorage.setItem('globalBranchId', parsed.branchID.toString());
            localStorage.setItem('globalBranchId', parsed.branchID.toString());
          }
          return parsed;
        } else {
          sessionStorage.removeItem('bhisi_user');
          return null;
        }
      } catch {
        sessionStorage.removeItem('bhisi_user');
        return null;
      }
    }
    return null;
  });

  const login = (userData: AuthUser) => {
    setUser(userData);
    sessionStorage.setItem('bhisi_user', JSON.stringify(userData));
    localStorage.removeItem('bhisi_user'); // Never persist sensitive banking session on disk
    if (userData?.branchID) {
      sessionStorage.setItem('globalBranchId', userData.branchID.toString());
      localStorage.setItem('globalBranchId', userData.branchID.toString());
    }
    try {
      const channel = new BroadcastChannel('smart_banking_session_sync');
      channel.postMessage({ type: 'LOGIN', user: userData });
      channel.close();
    } catch (_) {}
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('bhisi_user');
    sessionStorage.removeItem('globalBranchId');
    localStorage.removeItem('bhisi_user');
    localStorage.removeItem('globalBranchId');
    try {
      const channel = new BroadcastChannel('smart_banking_session_sync');
      channel.postMessage({ type: 'LOGOUT' });
      channel.close();
    } catch (_) {}
  };

  const switchBranch = async (branchID: number, branchName: string): Promise<boolean> => {
    try {
      const token = user?.token;
      if (!token) return false;

      const res = await fetch('/api/Auth/switch-branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetBranchID: branchID })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to switch branch:", errorText);
        return false;
      }

      const data = await res.json();
      const updatedUser: AuthUser = {
        ...user!,
        token: data.token || user!.token,
        branchID: data.branchID || branchID,
        branchName: data.branchName || branchName,
        businessDate: data.businessDate || user!.businessDate
      };

      setUser(updatedUser);
      sessionStorage.setItem('bhisi_user', JSON.stringify(updatedUser));
      sessionStorage.setItem('globalBranchId', branchID.toString());
      localStorage.setItem('globalBranchId', branchID.toString());

      try {
        const channel = new BroadcastChannel('smart_banking_session_sync');
        channel.postMessage({ type: 'BRANCH_SWITCH', user: updatedUser });
        channel.close();
      } catch (_) {}

      return true;
    } catch (err) {
      console.error("Error switching branch:", err);
      return false;
    }
  };

  const markPasswordChanged = () => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = {
        ...prevUser,
        requirePasswordChange: false
      };
      sessionStorage.setItem('bhisi_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('smart_banking_session_sync');
      channel.onmessage = (event) => {
        if (!event?.data) return;
        if (event.data.type === 'REQUEST_SESSION') {
          const current = sessionStorage.getItem('bhisi_user');
          if (current) {
            channel?.postMessage({ type: 'SESSION_RESPONSE', user: JSON.parse(current) });
          }
        } else if (event.data.type === 'SESSION_RESPONSE' || event.data.type === 'LOGIN') {
          if (event.data.user) {
            sessionStorage.setItem('bhisi_user', JSON.stringify(event.data.user));
            if (event.data.user.branchID) {
              sessionStorage.setItem('globalBranchId', event.data.user.branchID.toString());
              localStorage.setItem('globalBranchId', event.data.user.branchID.toString());
            }
            setUser(event.data.user);
          }
        } else if (event.data.type === 'LOGOUT') {
          sessionStorage.removeItem('bhisi_user');
          sessionStorage.removeItem('globalBranchId');
          localStorage.removeItem('bhisi_user');
          localStorage.removeItem('globalBranchId');
          setUser(null);
        } else if (event.data.type === 'BRANCH_SWITCH' && event.data.user) {
          sessionStorage.setItem('bhisi_user', JSON.stringify(event.data.user));
          setUser(event.data.user);
        }
      };

      if (!sessionStorage.getItem('bhisi_user')) {
        channel.postMessage({ type: 'REQUEST_SESSION' });
      }
    } catch (_) {}

    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  const globalBranchId = user?.branchID
    ? user.branchID.toString()
    : (sessionStorage.getItem('globalBranchId') || localStorage.getItem('globalBranchId') || null);

  return (
    <AuthContext.Provider value={{ user, globalBranchId, login, logout, switchBranch, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
