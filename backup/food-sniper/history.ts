import { collection, getDocs, orderBy, query, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type FoodRequest = {
  id: string;
  createdAt: Date;
  query: string;
  items: { name: string; why: string }[];
  stores: { name: string; distanceM?: number; confidence: number; note: string }[];
  shoppingList: string[];
};

export async function fetchFoodRequests(uid: string): Promise<FoodRequest[]> {
  const ref = collection(db, "foodRequests", uid, "items");
  const snap = await getDocs(query(ref, orderBy("createdAt", "desc"), limit(10)));
  const results: FoodRequest[] = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const rawTimestamp = data.createdAt;
    const createdAt = rawTimestamp instanceof Timestamp ? rawTimestamp.toDate() : new Date();
    results.push({
      id: docSnap.id,
      createdAt,
      query: data.query ?? "",
      items: (data.recommendations ?? data.items ?? []) as FoodRequest["items"],
      stores: (data.stores ?? []) as FoodRequest["stores"],
      shoppingList: (data.shoppingList ?? []) as FoodRequest["shoppingList"],
    });
  });

  return results;
}
