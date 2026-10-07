// Единое хранилище профиля ученика.
// Все страницы читают данные из "user". saveProfile обновляет и profile, и user.

const PROFILE_KEY = "schedule_profile_v1";
const USER_KEY = "user";

export function saveProfile(profile) {
  if (typeof window === "undefined") return;

  // 1. Сохраняем профиль (для онбординга — какие настройки при первом заходе)
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {}

  // 2. Синхронизируем с localStorage.user — это единый источник для страниц
  try {
    const raw = localStorage.getItem(USER_KEY);
    let user = {};
    if (raw) {
      try { user = JSON.parse(raw); } catch (e) {}
    }
    const merged = {
      ...user,
      grade: profile.grade || user.grade,
      group: profile.group || user.group,
      device: profile.device || user.device
    };
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
  } catch (e) {}

  // 3. Уведомляем всех слушателей (Layout, schedule.js и т.д.)
  window.dispatchEvent(new Event("profile-changed"));
}

export function loadProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function loadUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("profile-changed"));
}