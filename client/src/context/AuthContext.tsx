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
}

interface AuthContextType {
  user: AuthUser | null;
  login: (userData: AuthUser) => void;
  logout: () => void;
  switchBranch: (branchID: number, branchName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('bhisi_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && (parsed.token || parsed.username)) {
          if (parsed?.branchID) {
            localStorage.setItem('globalBranchId', parsed.branchID.toString());
          }
          return parsed;
        } else {
          localStorage.removeItem('bhisi_user');
          return null;
        }
      } catch {
        localStorage.removeItem('bhisi_user');
        return null;
      }
    }
    return null;
  });

  const login = (userData: AuthUser) => {
    setUser(userData);
    localStorage.setItem('bhisi_user', JSON.stringify(userData));
    sessionStorage.setItem('just_logged_in', 'true');
    if (userData?.branchID) {
      localStorage.setItem('globalBranchId', userData.branchID.toString());
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bhisi_user');
    localStorage.removeItem('globalBranchId');
    sessionStorage.removeItem('just_logged_in');
  };

  const switchBranch = (branchID: number, branchName: string) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = {
        ...prevUser,
        branchID,
        branchName
      };
      localStorage.setItem('bhisi_user', JSON.stringify(updatedUser));
      localStorage.setItem('globalBranchId', branchID.toString());
      return updatedUser;
    });
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, switchBranch }}>
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
