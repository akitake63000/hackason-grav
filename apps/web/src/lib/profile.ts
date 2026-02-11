import { doc, getDoc } from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

export type UserProfile = {
  gender?: 'male' | 'female' | 'prefer-not-to-say';
  birthDate?: string;
  concernAreas?: string[];
  displayName?: string;
  streakDays?: number; // lifestyle plan用
  homeStreakDays?: number; // ホーム画面連続日数
  homeTotalDays?: number; // 通算日数
  lastHomeVisitDate?: string; // 最後の訪問日（YYYY-MM-DD）
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
