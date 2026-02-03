import { doc, getDoc } from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

export const hasUserProfile = async (uid: string): Promise<boolean> => {
  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, "users", uid, "profile", "default"));
  return snapshot.exists();
};
