import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

// Получить список классов
export async function getAllClasses() {
  const snap = await getDocs(collection(db, "classes"));
  const list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));
  // Сортируем: сначала по числу, потом по букве
  list.sort((a, b) => {
    const na = parseInt(a.id);
    const nb = parseInt(b.id);
    if (na !== nb) return na - nb;
    return a.id.localeCompare(b.id);
  });
  return list;
}

// Создать класс
export async function createClass(name, groups = ["1", "2"]) {
  await setDoc(doc(db, "classes", name), { name, groups });
}

// Удалить класс
export async function deleteClass(name) {
  await deleteDoc(doc(db, "classes", name));
}

// Обновить список групп в классе
export async function updateGroups(name, groups) {
  const ref = doc(db, "classes", name);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await setDoc(ref, { ...snap.data(), groups });
}

// Добавить группу в класс
export async function addGroup(name, group) {
  const ref = doc(db, "classes", name);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const groups = data.groups || [];
  if (groups.includes(group)) return;
  groups.push(group);
  groups.sort();
  await setDoc(ref, { ...data, groups });
}

// Удалить группу из класса
export async function removeGroup(name, group) {
  const ref = doc(db, "classes", name);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const groups = (data.groups || []).filter(g => g !== group);
  await setDoc(ref, { ...data, groups });
}

// Создать стартовые классы (вызывается один раз)
export async function seedDefaultClasses() {
  const defaults = [
    { name: "10А", groups: ["1", "2"] },
    { name: "10Б", groups: ["1", "2"] },
    { name: "10В", groups: ["1", "2"] },
    { name: "10Г", groups: ["1", "2"] }
  ];
  for (const c of defaults) {
    const ref = doc(db, "classes", c.name);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { name: c.name, groups: c.groups });
    }
  }
}