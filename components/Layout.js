import Link from "next/link";
import { useRouter } from "next/router";
import ScheduleIcon from "./icons/ScheduleIcon";
import AdminIcon from "./icons/AdminIcon";
import LogoutIcon from "./icons/LogoutIcon";

export default function Layout({ children, user }) {
  const router = useRouter();
  const isAdmin = user?.role === "admin";

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
            {isAdmin && (
              <Link href="/admin" className={router.pathname === "/admin" ? "active" : ""}>
                <AdminIcon /> <span>Админ-панель</span>
              </Link>
            )}
            <a onClick={logout} style={{ cursor: "pointer" }}>
              <LogoutIcon /> <span>Выйти</span>
            </a>
          </>
        )}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}