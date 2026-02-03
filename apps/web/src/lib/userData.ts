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
  | "foodRequests";

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
  const snapshot = await getDocs(collection(db, ...path));
  if (!snapshot.empty) {
    await deleteDocsInBatch(snapshot.docs);
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
  for (const name of SIMPLE_COLLECTIONS) {
    if (!keys.includes(name)) continue;
    await deleteCollection(["users", uid, name]);
  }

  if (keys.includes("conversations")) {
    await deleteConversations(uid);
  }

  if (keys.includes("photos")) {
    await deleteStoragePrefix(`users/${uid}/photos`);
  }
};

export const deleteUserData = async (uid: string): Promise<void> => {
  await deleteUserDataByKeys(uid, [
    "profile",
    "photos",
    "analysisResults",
    "reports",
    "conversations",
    "tendencyScores",
    "foodRequests",
  ]);

  const db = getFirestoreDb();

  await deleteDoc(doc(db, "users", uid)).catch(() => undefined);
  await deleteStoragePrefix(`users/${uid}`);
};
