import Link from "next/link";
import { useRouter } from "next/router";

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
              📖 Расписание
            </Link>
            {isAdmin && (
              <Link href="/admin" className={router.pathname === "/admin" ? "active" : ""}>
                ⚙️ Админ-панель
              </Link>
            )}
            <a onClick={logout} style={{ cursor: "pointer" }}>🚪 Выйти</a>
          </>
        )}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}