import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ScheduleIcon from "./icons/ScheduleIcon";
import AdminIcon from "./icons/AdminIcon";
import LogoutIcon from "./icons/LogoutIcon";
import SunIcon from "./icons/SunIcon";
import MoonIcon from "./icons/MoonIcon";
import { loadProfile, clearProfile } from "../lib/storage";

export default function Layout({ children, user }) {
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const isGuest = user?.guest;
  const [theme, setTheme] = useState("dark");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleDeleteProfile = () => {
    localStorage.removeItem("user");
    clearProfile();
    router.push("/");
  };

  const settingsUser = user;

  return (
    <div className="app">
      {/* ======= Верхнее меню ======= */}
      <header className="topnav">
        <div className="topnav-left">
          <div className="topnav-logo">📅 Расписание</div>
        </div>

        <nav className="topnav-center">
          {user && (
            <>
              <Link href="/schedule" className={`nav-link ${router.pathname === "/schedule" ? "active" : ""}`}>
                <ScheduleIcon size={18} /> Расписание
              </Link>
              {isAdmin && (
                <Link href="/admin" className={`nav-link ${router.pathname === "/admin" ? "active" : ""}`}>
                  <AdminIcon size={18} /> Админ
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="topnav-right">
          <button className="icon-btn" onClick={toggleTheme} title="Сменить тему">
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
          {user && (
            <>
              <button className="icon-btn" onClick={() => setShowSettings(true)} title="Настройки">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {!isGuest && (
                <button className="icon-btn danger" onClick={handleLogout} title="Выйти">
                  <LogoutIcon size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* ======= Основной контент ======= */}
      <main className="main-full">
        <div className="container">{children}</div>
      </main>

      {/* ======= Модалка настроек ======= */}
      {showSettings && settingsUser && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Настройки</h3>
              <button className="icon-btn" onClick={() => setShowSettings(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="settings-row">
                <span>Ник</span>
                <strong>{settingsUser.nick}</strong>
              </div>
              <div className="settings-row">
                <span>Класс</span>
                <strong>{settingsUser.grade}</strong>
              </div>
              <div className="settings-row">
                <span>Группа</span>
                <strong>{settingsUser.group}</strong>
              </div>
              <div className="settings-row">
                <span>Роль</span>
                <strong>{settingsUser.role}</strong>
              </div>

              <div className="settings-actions">
                <a href="/settings" className="btn secondary">Изменить класс / группу</a>

                {!isGuest && (
                  <button className="secondary" onClick={handleLogout}>
                    Выйти из аккаунта
                  </button>
                )}

                <button className="danger-btn" onClick={() => {
                  if (confirm("Удалить профиль? Расписание и настройки будут сброшены, при следующем входе придётся выбрать заново.")) {
                    handleDeleteProfile();
                  }
                }}>
                  Удалить профиль
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}