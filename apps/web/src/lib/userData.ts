import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { deleteObject, listAll, ref as storageRef } from "firebase/storage";

import { getFirestoreDb, getFirebaseStorage } from "./firebase";

export type DeletableDataKey =
  | "profile"
  | "photos"
  | "analysisResults"
  | "reports"
  | "conversations"
  | "tendencyScores"
  | "foodRequests"
  | "plans";

const SIMPLE_COLLECTIONS: DeletableDataKey[] = [
  "profile",
  "photos",
  "analysisResults",
  "reports",
  "tendencyScores",
  "foodRequests",
];

const deleteDocsInBatch = async (
  docs: QueryDocumentSnapshot<DocumentData>[],
) => {
  const db = getFirestoreDb();
  const chunkSize = 450;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    docs.slice(i, i + chunkSize).forEach((snap) => batch.delete(snap.ref));
    await batch.commit();
  }
};

const deleteCollection = async (path: string[]) => {
  const db = getFirestoreDb();
  const collectionPath = path.join("/");
  try {
    const snapshot = await getDocs(collection(db, collectionPath));
    if (!snapshot.empty) {
      await deleteDocsInBatch(snapshot.docs);
      console.log(`Deleted ${snapshot.size} documents from ${collectionPath}`);
    }
  } catch (error) {
    console.error(`Failed to delete collection ${collectionPath}:`, error);
    throw error; // Re-throw to let caller handle it
  }
};

const deleteConversationMessages = async (uid: string, threadId: string) => {
  await deleteCollection(["users", uid, "conversations", threadId, "messages"]);
};

const deleteConversations = async (uid: string) => {
  const db = getFirestoreDb();
  const conversationsSnapshot = await getDocs(collection(db, "users", uid, "conversations"));
  for (const thread of conversationsSnapshot.docs) {
    await deleteConversationMessages(uid, thread.id);
    await deleteDoc(thread.ref);
  }
};

const deletePlanSubcollections = async (uid: string, planId: string) => {
  // Delete dailyActions subcollection
  await deleteCollection(["users", uid, "plans", planId, "dailyActions"]);
  // Delete logs subcollection
  await deleteCollection(["users", uid, "plans", planId, "logs"]);
};

const deletePlans = async (uid: string) => {
  const db = getFirestoreDb();
  const plansSnapshot = await getDocs(collection(db, "users", uid, "plans"));
  for (const plan of plansSnapshot.docs) {
    await deletePlanSubcollections(uid, plan.id);
    await deleteDoc(plan.ref);
  }
};

const deleteStoragePrefix = async (path: string) => {
  const storage = getFirebaseStorage();
  const rootRef = storageRef(storage, path);
  const list = await listAll(rootRef);
  await Promise.all(list.items.map((item) => deleteObject(item)));
  for (const prefix of list.prefixes) {
    await deleteStoragePrefix(prefix.fullPath);
  }
};

export const deleteUserDataByKeys = async (
  uid: string,
  keys: DeletableDataKey[],
): Promise<void> => {
  const errors: Error[] = [];

  // Delete simple collections
  for (const name of SIMPLE_COLLECTIONS) {
    if (!keys.includes(name)) continue;
    try {
      await deleteCollection(["users", uid, name]);
    } catch (error) {
      console.error(`Failed to delete ${name}:`, error);
      errors.push(error as Error);
    }
  }

  // Delete conversations (including messages subcollection)
  if (keys.includes("conversations")) {
    try {
      await deleteConversations(uid);
    } catch (error) {
      console.error("Failed to delete conversations:", error);
      errors.push(error as Error);
    }
  }

  // Delete plans (including dailyActions and logs subcollections)
  if (keys.includes("plans")) {
    try {
      await deletePlans(uid);
    } catch (error) {
      console.error("Failed to delete plans:", error);
      errors.push(error as Error);
    }
  }

  // Delete photos from Storage
  if (keys.includes("photos")) {
    try {
      await deleteStoragePrefix(`users/${uid}/photos`);
    } catch (error) {
      console.error("Failed to delete photos from storage:", error);
      errors.push(error as Error);
    }
  }

  // Delete visitHistory (client can delete this per firestore.rules)
  // Note: dailyMissions and chatTasks are read-only from client (firestore.rules line 50, 62),
  // so we skip them to avoid permission errors
  try {
    await deleteCollection(["users", uid, "visitHistory"]);
  } catch (error) {
    console.warn("Failed to delete visitHistory:", error);
    // Don't add to errors - this is optional
  }

  // If any critical errors occurred, throw
  if (errors.length > 0) {
    throw new Error(`Failed to delete ${errors.length} collection(s). Check console for details.`);
  }
};

export const deleteUserData = async (uid: string): Promise<void> => {
  // Delete all user data collections
  await deleteUserDataByKeys(uid, [
    "profile",
    "photos",
    "analysisResults",
    "reports",
    "conversations",
    "tendencyScores",
    "foodRequests",
    "plans",
  ]);

  const db = getFirestoreDb();

  // Delete user document (may not exist)
  await deleteDoc(doc(db, "users", uid)).catch(() => undefined);

  // Delete all storage for this user
  try {
    await deleteStoragePrefix(`users/${uid}`);
  } catch (error) {
    console.warn("Failed to delete user storage:", error);
    // Continue even if storage deletion fails (may not have any files)
  }
};
