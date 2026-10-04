import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./auth";
import { syncTimezone } from "./sync-timezone";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) await syncTimezone(firebaseUser.uid);
      // Ignore a stale result if auth changed while we were awaiting.
      if (auth.currentUser?.uid !== firebaseUser?.uid) return;
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshUser = useCallback(() => {
    if (auth.currentUser) {
      const updatedUser = Object.assign(
        Object.create(Object.getPrototypeOf(auth.currentUser)),
        auth.currentUser,
      );
      setUser(updatedUser);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshUser }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
