import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ScheduleIcon from "./icons/ScheduleIcon";
import AdminIcon from "./icons/AdminIcon";
import LogoutIcon from "./icons/LogoutIcon";
import SunIcon from "./icons/SunIcon";
import MoonIcon from "./icons/MoonIcon";
import CameraIcon from "./icons/CameraIcon";

export default function Layout({ children, user }) {
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const [theme, setTheme] = useState("dark");

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

  const logout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">📅 Расписание</div>
        {user && (
          <>
            <Link href="/schedule" className={router.pathname === "/schedule" ? "active" : ""}>
              <ScheduleIcon /> <span>Расписание</span>
            </Link>

            {!isAdmin && (
              <Link href="/stream" className={router.pathname === "/stream" ? "active" : ""}>
                <CameraIcon /> <span>Камера</span>
              </Link>
            )}

            {isAdmin && (
              <>
                <Link href="/admin" className={router.pathname === "/admin" ? "active" : ""}>
                  <AdminIcon /> <span>Админ-панель</span>
                </Link>
                <Link href="/watch" className={router.pathname === "/watch" ? "active" : ""}>
                  <CameraIcon /> <span>Камеры</span>
                </Link>
              </>
            )}

            <a onClick={logout}>
              <LogoutIcon /> <span>Выйти</span>
            </a>
          </>
        )}
        <div className="theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}