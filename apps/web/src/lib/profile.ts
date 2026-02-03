import { doc, getDoc } from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

export type UserProfile = {
  gender?: string;
  birthDate?: string;
  concernAreas?: string[];
  displayName?: string;
  streakDays?: number;
};

export const hasUserProfile = async (uid: string): Promise<boolean> => {
  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, "users", uid, "profile", "default"));
  return snapshot.exists();
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, "users", uid, "profile", "default"));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as UserProfile;
};
