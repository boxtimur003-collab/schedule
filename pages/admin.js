import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Layout from "../components/Layout";

const GRADES = ["10А", "10Б", "10В", "10Г"];
const GROUPS = ["1", "2"];
const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [grade, setGrade] = useState("10А");
  const [group, setGroup] = useState("1");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return router.push("/");
    const u = JSON.parse(stored);
    if (u.role !== "admin") return router.push("/schedule");
    setUser(u);
    loadFor(u.grade, u.group);
  }, []);

  const loadFor = async (g, gr) => {
    const id = `${g}-${gr}`;
    const snap = await getDoc(doc(db, "schedules", id));
    const data = snap.exists() ? snap.data() : {};
    setText(serialize(data));
  };

  const serialize = (data) => {
    return DAYS.map(d => {
      const lessons = data[d] || [];
      return `${d}\n${lessons.join("\n")}`;
    }).join("\n\n");
  };

  const parse = (raw) => {
    const out = {};
    raw.split("\n\n").forEach(block => {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      const [day, ...lessons] = lines;
      out[day] = lessons;
    });
    return out;
  };

  const saveToFirestore = async () => {
    setSaving(true);
    const data = parse(text);
    const id = `${grade}-${group}`;
    await setDoc(doc(db, "schedules", id), data);
    showToast(`Сохранено: ${id}`);
    setSaving(false);
  };

  const saveToGithub = async () => {
    setSaving(true);
    const data = parse(text);
    const id = `${grade}-${group}`;
    try {
      const res = await fetch("/api/saveSchedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data })
      });
      const json = await res.json();
      if (json.ok) showToast(`GitHub: ${id} сохранено`);
      else showToast("Ошибка GitHub: " + json.error);
    } catch (e) {
      showToast("Ошибка: " + e.message);
    }
    setSaving(false);
  };

  const saveBoth = async () => {
    await saveToFirestore();
    await saveToGithub();
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const onGradeChange = async (g) => {
    setGrade(g);
    await loadFor(g, group);
  };
  const onGroupChange = async (gr) => {
    setGroup(gr);
    await loadFor(grade, gr);
  };

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>Админ-панель</h1>
        <div className="user-badge">
          {user.nick} <span className="role">admin</span>
        </div>
      </div>

      <div className="tabs">
        {GRADES.map(g => (
          <div key={g} className={`tab ${grade === g ? "active" : ""}`} onClick={() => onGradeChange(g)}>
            {g}
          </div>
        ))}
      </div>

      <div className="tabs">
        {GROUPS.map(gr => (
          <div key={gr} className={`tab ${group === gr ? "active" : ""}`} onClick={() => onGroupChange(gr)}>
            Группа {gr}
          </div>
        ))}
      </div>

      <div className="editor">
        <div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 10 }}>
            Формат: день, каждый урок с новой строки. Пустая строка между днями.
          </p>
          <textarea rows="20" value={text} onChange={e => setText(e.target.value)} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="secondary" onClick={saveToFirestore} disabled={saving}>💾 Firestore</button>
            <button className="secondary" onClick={saveToGithub} disabled={saving}>🐙 GitHub</button>
            <button onClick={saveBoth} disabled={saving}>{saving ? "..." : "💾 Сохранить всё"}</button>
          </div>
        </div>
        <div className="preview">
          <h3 style={{ marginBottom: 12, fontSize: 15, color: "var(--accent)" }}>Предпросмотр</h3>
          {Object.entries(parse(text)).map(([day, lessons]) => (
            <div key={day} style={{ marginBottom: 12 }}>
              <strong>{day}</strong>
              <ul style={{ listStyle: "none", paddingLeft: 12, marginTop: 4 }}>
                {lessons.map((l, i) => <li key={i} style={{ fontSize: 13, padding: "2px 0" }}>{i + 1}. {l}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}