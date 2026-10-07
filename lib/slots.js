import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const DEFAULT_SLOTS = [
  { slot: 1, start: "08:30", end: "09:15" },
  { slot: 2, start: "09:25", end: "10:10" },
  { slot: 3, start: "10:25", end: "11:10" },
  { slot: 4, start: "11:25", end: "12:10" },
  { slot: 5, start: "12:25", end: "13:10" },
  { slot: 6, start: "13:20", end: "14:05" },
  { slot: 7, start: "14:15", end: "15:00" }
];

export async function getTimeSlots() {
  const ref = doc(db, "settings", "timeSlots");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return data.slots || DEFAULT_SLOTS;
  }
  // Создаём дефолтные при первом обращении
  await setDoc(ref, { slots: DEFAULT_SLOTS });
  return DEFAULT_SLOTS;
}

export async function saveTimeSlots(slots) {
  const ref = doc(db, "settings", "timeSlots");
  await setDoc(ref, { slots });
}

export { DEFAULT_SLOTS };