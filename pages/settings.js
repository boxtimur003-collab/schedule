import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { getAllClasses } from "../lib/classes";
import { loadProfile, loadUser, saveProfile } from "../lib/storage";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState("");
  const [group, setGroup] = useState("");
  const [saved, setSaved] = useState("");
  const router = useRouter();

  useEffect(() => {
    const stored = loadUser();
    const profile = loadProfile();
    let u = stored;
    if (!u && profile) {
      u = { nick: "Гость", grade: profile.grade, group: profile.group, role: "student", guest: true };
    }
    if (!u) {
      router.push("/");
      return;
    }
    setUser(u);

    // Приоритет: user → profile
    const currentDevice = u.device || profile?.device || "desktop";
    const currentGrade = u.grade || profile?.grade || "";
    const currentGroup = u.group || profile?.group || "";

    setDevice(currentDevice);
    setGrade(currentGrade);
    setGroup(currentGroup);
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const list = await getAllClasses();
      setClasses(list);
    } catch (e) {
      console.error(e);
    }
  };

  const currentGroups = classes.find(c => c.id === grade)?.groups || [];

  const handleSave = () => {
    saveProfile({ device, grade, group, onboardingDone: true });
    setSaved("Сохранено");
    // Обновляем локальный user
    const updated = { ...user, grade, group, device };
    setUser(updated);
    setTimeout(() => setSaved(""), 2000);
  };

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>Настройки</h1>
      </div>

      <div style={{ maxWidth: 480 }}>
        <div className="form-card" style={{ margin: 0, maxWidth: "100%" }}>
          <div className="field">
            <label>Устройство</label>
            <select value={device} onChange={e => setDevice(e.target.value)}>
              <option value="mobile">Мобильное</option>
              <option value="desktop">ПК</option>
            </select>
          </div>
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
          <button onClick={handleSave}>Сохранить</button>
          {saved && <p style={{ color: "var(--ok)", marginTop: 12, textAlign: "center" }}>{saved}</p>}
        </div>
      </div>
    </Layout>
  );
}