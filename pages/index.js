import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db, NICK_DOMAIN } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAllClasses } from "../lib/classes";
import { loadProfile, saveProfile } from "../lib/storage";

export default function Home() {
  const [mode, setMode] = useState("welcome"); // welcome | onboarding | login
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState("");
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState("");
  const [group, setGroup] = useState("");
  const [error, setError] = useState("");
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const profile = loadProfile();
    if (profile && profile.grade && profile.group) {
      router.push("/schedule");
    }
  }, []);

  useEffect(() => {
    if (mode === "onboarding" && step === 2) {
      loadClasses();
    }
  }, [mode, step]);

  const loadClasses = async () => {
    try {
      const list = await getAllClasses();
      setClasses(list);
      if (list.length > 0) {
        setGrade(list[0].id);
        setGroup((list[0].groups || [])[0] || "1");
      }
    } catch (e) {
      setError("Не удалось загрузить классы: " + e.message);
    }
  };

  const handleDevice = (d) => {
    setDevice(d);
    setStep(1);
  };

  const handleFinish = () => {
    if (!grade || !group) {
      setError("Выбери класс и группу");
      return;
    }
    saveProfile({ device, grade, group, onboardingDone: true });
    router.push("/schedule");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const email = `${nick.toLowerCase()}@${NICK_DOMAIN}`;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uDoc = await getDoc(doc(db, "users", cred.user.uid));
      const userData = uDoc.data();
      localStorage.setItem("user", JSON.stringify({ uid: cred.user.uid, ...userData }));
      if (userData.role === "admin") router.push("/admin");
      else router.push("/schedule");
    } catch (err) {
      setLoginError("Неверный ник или пароль");
    }
  };

  const currentGroups = classes.find(c => c.id === grade)?.groups || [];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Фоновый градиент */}
      <div style={{
        position: "absolute",
        top: "-30%",
        left: "-20%",
        width: "60%",
        height: "60%",
        background: "radial-gradient(circle, rgba(255,122,24,0.15) 0%, transparent 60%)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        bottom: "-30%",
        right: "-20%",
        width: "60%",
        height: "60%",
        background: "radial-gradient(circle, rgba(255,181,71,0.1) 0%, transparent 60%)",
        pointerEvents: "none"
      }} />

      <div style={{
        maxWidth: 520,
        width: "100%",
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        padding: 40,
        boxShadow: "var(--shadow-lg)",
        position: "relative",
        zIndex: 1,
        animation: "fadeIn 0.5s ease"
      }}>

        {/* ===== Приветствие ===== */}
        {mode === "welcome" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <h1 style={{ fontSize: 26, marginBottom: 8, letterSpacing: -0.5 }}>Расписание школы</h1>
              <p style={{ color: "var(--text-dim)", fontSize: 15 }}>
                Смотри расписание своего класса в реальном времени
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => { setMode("onboarding"); setStep(0); }}>
                Начать без аккаунта
              </button>
              <button className="secondary" onClick={() => setMode("login")}>
                Войти в аккаунт
              </button>
              <a href="/register" className="btn secondary" style={{
                textAlign: "center",
                textDecoration: "none",
                display: "block"
              }}>
                Зарегистрироваться
              </a>
            </div>

            <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", marginTop: 24 }}>
              Аккаунт нужен только для админов. Ученикам достаточно выбрать класс.
            </p>
          </>
        )}

        {/* ===== Онбординг ===== */}
        {mode === "onboarding" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  background: step >= i ? "var(--accent)" : "var(--bg-3)",
                  transition: "background 0.3s ease"
                }} />
              ))}
            </div>

            {step === 0 && (
              <>
                <h2 style={{ fontSize: 22, marginBottom: 8 }}>Твоё устройство</h2>
                <p style={{ color: "var(--text-dim)", marginBottom: 24, fontSize: 14 }}>
                  Выбери, чтобы мы подстроили интерфейс
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    className="secondary"
                    onClick={() => handleDevice("mobile")}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 24 }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="2" width="12" height="20" rx="2" />
                      <line x1="12" y1="18" x2="12" y2="18" />
                    </svg>
                    <span>Мобильное</span>
                  </button>
                  <button
                    className="secondary"
                    onClick={() => handleDevice("desktop")}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 24 }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span>ПК</span>
                  </button>
                </div>
                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <a onClick={() => setMode("welcome")} style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: 13 }}>← Назад</a>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 style={{ fontSize: 22, marginBottom: 8 }}>Ты выбрал</h2>
                <p style={{ color: "var(--text-dim)", marginBottom: 24, fontSize: 14 }}>
                  {device === "mobile" ? "Мобильное устройство" : "Персональный компьютер"}
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="secondary" onClick={() => setStep(0)}>Назад</button>
                  <button onClick={() => setStep(2)}>Далее</button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 style={{ fontSize: 22, marginBottom: 8 }}>Твой класс</h2>
                <p style={{ color: "var(--text-dim)", marginBottom: 24, fontSize: 14 }}>
                  Можно поменять позже в настройках
                </p>

                {error && <div className="error">{error}</div>}

                <div className="field">
                  <label>Класс</label>
                  <select value={grade} onChange={e => {
                    setGrade(e.target.value);
                    const g = classes.find(c => c.id === e.target.value)?.groups || [];
                    setGroup(g[0] || "1");
                  }}>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Группа</label>
                  <select value={group} onChange={e => setGroup(e.target.value)}>
                    {currentGroups.map(g => <option key={g} value={g}>Группа {g}</option>)}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  <button className="secondary" onClick={() => setStep(1)}>Назад</button>
                  <button onClick={handleFinish}>Продолжить</button>
                </div>
              </>
            )}
          </>
        )}

        {/* ===== Вход ===== */}
        {mode === "login" && (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 24, textAlign: "center" }}>Вход в аккаунт</h2>
            {loginError && <div className="error">{loginError}</div>}
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Ник</label>
                <input value={nick} onChange={e => setNick(e.target.value)} placeholder="admin" required />
              </div>
              <div className="field">
                <label>Пароль</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit">Войти</button>
            </form>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 13 }}>
              <a onClick={() => setMode("welcome")} style={{ cursor: "pointer", color: "var(--text-dim)" }}>← Назад</a>
              <a href="/register">Зарегистрироваться</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}