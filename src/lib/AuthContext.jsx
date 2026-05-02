import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { getOrCreateUserRole } from './usersApi';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);         // e.g. ['admin'] | ['provider'] | ['intern'] | ['associate', 'provider'] | ['supervisor', 'provider']
  const [providerName, setProviderName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const idleTimer = useRef(null);

  // Idle-activity auto-logout: signs the user out after 60 min of no interaction
  useEffect(() => {
    if (!user) return;

    function resetTimer() {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        firebaseSignOut(auth);
      }, IDLE_TIMEOUT_MS);
    }

    resetTimer();
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      clearTimeout(idleTimer.current);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRoles([]);
        setProviderName(null);
        setAccessDenied(false);
        setLoading(false);
        return;
      }

      try {
        const userData = await getOrCreateUserRole(firebaseUser.uid, firebaseUser.email);
        if (!userData) {
          setUser(firebaseUser);
          setRoles([]);
          setProviderName(null);
          setAccessDenied(true);
        } else {
          setUser(firebaseUser);
          setRoles(userData.roles ?? []);
          setProviderName(userData.providerName ?? null);
          setAccessDenied(false);
        }
      } catch (e) {
        console.error('Auth role resolution failed:', e);
        setUser(firebaseUser);
        setRoles([]);
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function signIn() {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (e) {
      setLoading(false);
      throw e;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  // Convenience helpers
  const isAdmin = roles.includes('admin');
  const isSupervisor = roles.includes('supervisor') || roles.includes('admin');
  const isIntern = roles.includes('intern');
  const isAssociate = roles.includes('associate');
  const isProvider = roles.includes('provider');

  return (
    <AuthContext.Provider value={{
      user, roles, providerName, loading, accessDenied,
      isAdmin, isSupervisor, isIntern, isAssociate, isProvider,
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
