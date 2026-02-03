import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const getAuthSafe = () => {
  if (!isFirebaseConfigured()) {
    return null;
  }
  try {
    return getFirebaseAuth();
  } catch (error) {
    console.warn("Firebase auth is not available.", error);
    return null;
  }
};

export const useAuth = (): { user: User | null; loading: boolean } => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthSafe();
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  return { user, loading };
};

export const signInWithGoogle = async (): Promise<User | null> => {
  const auth = getAuthSafe();
  if (!auth) {
    throw new Error("Firebase Auth is not configured.");
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
};

export const handleRedirectResult = async (): Promise<User | null> => {
  const auth = getAuthSafe();
  if (!auth) {
    return null;
  }
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (error) {
    console.warn("Failed to handle redirect result.", error);
    return null;
  }
};

export const signOutUser = async (): Promise<void> => {
  const auth = getAuthSafe();
  if (!auth) {
    return;
  }
  await signOut(auth);
};

export const getIdToken = async (forceRefresh = false): Promise<string | null> => {
  const auth = getAuthSafe();
  if (!auth?.currentUser) {
    return null;
  }
  return auth.currentUser.getIdToken(forceRefresh);
};
