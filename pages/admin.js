import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import {
  doc, getDoc, setDoc, collection, getDocs, onSnapshot,
  addDoc, query, where
} from "firebase/firestore";
import Layout from "../components/Layout";
import SaveIcon from "../components/icons/SaveIcon";
import GithubIcon from "../components/icons/GithubIcon";
import FirebaseIcon from "../components/icons/FirebaseIcon";
import CameraIcon from "../components/icons/CameraIcon";
import { getAllClasses, createClass, deleteClass, addGroup, removeGroup } from "../lib/classes";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("schedule");
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState("");
  const [group, setGroup] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [newClass, setNewClass] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [users, setUsers] = useState([]);
  const [streams, setStreams] = useState({});
  const [watching, setWatching] = useState(null);
  const [watchStatus, setWatchStatus] = useState("");
  const [watchInfo, setWatchInfo] = useState("");
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const unsubsRef = useRef([]);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return router.push("/");
    const u = JSON.parse(stored);
    if (u.role !== "admin") return router.push("/schedule");
    setUser(u);
    init();
  }, []);

  const init = async () => {
    await reloadClasses();
    await loadUsers();

    const unsub = onSnapshot(collection(db, "streams"), (snap) => {
      const map = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.online) map[d.id] = data;
      });
      setStreams(map);
    });
    unsubsRef.current.push(unsub);
  };

  const reloadClasses = async () => {
    const list = await getAllClasses();
    setClasses(list);
    if (list.length > 0 && !grade) {
      setGrade(list[0].id);
      const groups = list[0].groups || [];
      setGroup(groups[0] || "1");
      await loadSchedule(list[0].id, groups[0] || "1");
    }
  };

  const loadSchedule = async (g, gr) => {
    if (!g || !gr) return;
    const id = `${g}-${gr}`;
    const snap = await getDoc(doc(db, "schedules", id));
    const data = snap.exists() ? snap.data() : {};
    setText(serialize(data));
  };

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setUsers(list);
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
    showToast(`Firestore: ${id} сохранено`);
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
    const groups = classes.find(c => c.id === g)?.groups || [];
    const gr = groups[0] || "1";
    setGroup(gr);
    await loadSchedule(g, gr);
  };

  const onGroupChange = async (gr) => {
    setGroup(gr);
    await loadSchedule(grade, gr);
  };

  const handleCreateClass = async () => {
    const name = newClass.trim().toUpperCase();
    if (!name) return;
    if (classes.find(c => c.id === name)) {
      showToast("Такой класс уже есть");
      return;
    }
    await createClass(name, ["1", "2"]);
    setNewClass("");
    await reloadClasses();
    showToast("Класс добавлен: " + name);
  };

  const handleDeleteClass = async (name) => {
    if (!confirm(`Удалить класс ${name}?`)) return;
    await deleteClass(name);
    await reloadClasses();
    showToast("Класс удалён: " + name);
  };

  const handleAddGroup = async (className) => {
    if (!className || !newGroup.trim()) return;
    await addGroup(className, newGroup.trim());
    setNewGroup("");
    await reloadClasses();
    showToast(`Группа ${newGroup} добавлена в ${className}`);
  };

  const handleRemoveGroup = async (name, g) => {
    if (!confirm(`Удалить группу ${g} из ${name}?`)) return;
    await removeGroup(name, g);
    await reloadClasses();
    showToast(`Группа ${g} удалена из ${name}`);
  };

  const startWatch = async (targetUid) => {
    if (!streams[targetUid]) {
      showToast("Этот пользователь сейчас не стримит");
      return;
    }
    stopWatch();

    setWatching(targetUid);
    setWatchStatus("Установка соединения...");
    setWatchInfo("");

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      setWatchStatus("Получение видео...");
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().then(() => {
          setWatchStatus("Видео подключено");
          setTimeout(() => {
            const v = videoRef.current;
            if (v) {
              if (v.videoWidth === 0) {
                setWatchInfo("Кадры не идут. Ученик должен держать экран активным.");
              } else {
                setWatchInfo(`Кадры: ${v.videoWidth}x${v.videoHeight}`);
              }
            }
          }, 2000);
        }).catch((e) => setWatchStatus("Ошибка: " + e.message));
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, "signals"), {
          from: user.uid,
          to: targetUid,
          type: "ice",
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          createdAt: new Date().toISOString()
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("admin watch ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setWatchStatus("Соединение установлено");
      }
      if (pc.iceConnectionState === "failed") {
        setWatchStatus("ICE failed. TURN не сработал — попробуй с телефона по Wi-Fi.");
      }
    };
    pc.onconnectionstatechange = () => {
      console.log("admin watch Conn:", pc.connectionState);
    };

    const offer = await pc.createOffer({ offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);

    await addDoc(collection(db, "signals"), {
      from: user.uid,
      to: targetUid,
      type: "offer",
      sdp: offer.sdp,
      createdAt: new Date().toISOString()
    });

    setWatchStatus("Ожидание ответа...");

    const qAnswer = query(
      collection(db, "signals"),
      where("from", "==", targetUid),
      where("to", "==", user.uid),
      where("type", "==", "answer")
    );
    const unsubAnswer = onSnapshot(qAnswer, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        if (data.sdp && pc.signalingState !== "stable") {
          await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
          setWatchStatus("Видео подключено");
        }
      }
    });
    unsubsRef.current.push(unsubAnswer);

    const qIce = query(
      collection(db, "signals"),
      where("from", "==", targetUid),
      where("to", "==", user.uid),
      where("type", "==", "ice")
    );
    const unsubIce = onSnapshot(qIce, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        try {
          await pc.addIceCandidate({
            candidate: data.candidate,
            sdpMLineIndex: data.sdpMLineIndex
          });
        } catch (e) {}
      }
    });
    unsubsRef.current.push(unsubIce);
  };

  const stopWatch = () => {
    unsubsRef.current = unsubsRef.current.filter(u => {
      if (typeof u === "function") {
        try { u(); } catch (e) {}
        return false;
      }
      return true;
    });
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setWatching(null);
    setWatchStatus("");
    setWatchInfo("");
  };

  useEffect(() => {
    return () => {
      unsubsRef.current.forEach(u => { try { u(); } catch (e) {} });
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  if (!user) return null;

  const currentGroups = classes.find(c => c.id === grade)?.groups || [];

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>Админ-панель</h1>
        <div className="user-badge">
          {user.nick} <span className="role">admin</span>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === "schedule" ? "active" : ""}`} onClick={() => setTab("schedule")}>
          📖 Расписание
        </div>
        <div className={`tab ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}>
          🏫 Классы
        </div>
        <div className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
          👥 Пользователи
        </div>
      </div>

      {tab === "schedule" && (
        <>
          <div className="tabs">
            {classes.map(c => (
              <div key={c.id} className={`tab ${grade === c.id ? "active" : ""}`} onClick={() => onGradeChange(c.id)}>
                {c.id}
              </div>
            ))}
          </div>
          <div className="tabs">
            {currentGroups.map(gr => (
              <div key={gr} className={`tab ${group === gr ? "active" : ""}`} onClick={() => onGroupChange(gr)}>
                Группа {gr}
              </div>
            ))}
          </div>

          <div className="editor">
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 10 }}>
                Редактируется: <strong style={{ color: "var(--accent)" }}>{grade} — группа {group}</strong>
              </p>
              <textarea rows="20" value={text} onChange={e => setText(e.target.value)} />
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="secondary" style={{ display: "flex", alignItems: "center", gap: 6, width: "auto" }} onClick={saveToFirestore} disabled={saving}>
                  <FirebaseIcon /> Firestore
                </button>
                <button className="secondary" style={{ display: "flex", alignItems: "center", gap: 6, width: "auto" }} onClick={saveToGithub} disabled={saving}>
                  <GithubIcon /> GitHub
                </button>
                <button style={{ display: "flex", alignItems: "center", gap: 6, width: "auto" }} onClick={saveBoth} disabled={saving}>
                  <SaveIcon /> {saving ? "Сохранение..." : "Сохранить всё"}
                </button>
              </div>
            </div>
            <div className="preview">
              <h3 style={{ marginBottom: 12, fontSize: 15, color: "var(--accent)" }}>Предпросмотр — {grade}/{group}</h3>
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
        </>
      )}

      {tab === "classes" && (
        <div style={{ maxWidth: 700 }}>
          <div className="form-card" style={{ margin: "0 0 20px 0", maxWidth: "100%" }}>
            <h3 style={{ marginBottom: 12, color: "var(--accent)" }}>Добавить новый класс</h3>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={newClass}
                onChange={e => setNewClass(e.target.value)}
                placeholder="Например: 11А"
                style={{ flex: 1 }}
              />
              <button onClick={handleCreateClass} style={{ width: "auto" }}>Добавить</button>
            </div>
          </div>

          {classes.map(c => (
            <div key={c.id} className="day-card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 18, color: "var(--accent)" }}>{c.id}</strong>
                <button className="secondary" style={{ width: "auto", fontSize: 12, padding: "4px 10px" }} onClick={() => handleDeleteClass(c.id)}>
                  Удалить класс
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {(c.groups || []).map(g => (
                  <span key={g} style={{
                    background: "var(--bg-3)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    Группа {g}
                    <span
                      style={{ cursor: "pointer", color: "var(--danger)" }}
                      onClick={() => handleRemoveGroup(c.id, g)}
                    >×</span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={grade === c.id ? newGroup : ""}
                  onFocus={() => setGrade(c.id)}
                  onChange={e => setNewGroup(e.target.value)}
                  placeholder="Номер группы"
                  style={{ flex: 1 }}
                />
                <button className="secondary" style={{ width: "auto" }} onClick={() => handleAddGroup(c.id)}>
                  Добавить группу
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div>
          {watching && (
            <div style={{
              background: "var(--bg-2)",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ color: "var(--accent)" }}>
                  Смотрю: {users.find(u => u.id === watching)?.nick || watching}
                </h3>
                <button className="secondary" style={{ width: "auto" }} onClick={stopWatch}>
                  Закрыть
                </button>
              </div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: "100%", maxWidth: 700, borderRadius: 8, background: "#000", minHeight: 350 }}
              />
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{watchStatus}</p>
              {watchInfo && (
                <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>{watchInfo}</p>
              )}
            </div>
          )}

          <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>
            Всего: {users.length} пользователей · Онлайн: {Object.keys(streams).length}
          </p>
          <table>
            <thead>
              <tr>
                <th>Ник</th>
                <th>Класс</th>
                <th>Группа</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Стрим</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const online = !!streams[u.id];
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td>{u.nick}</td>
                    <td>{u.grade}</td>
                    <td>{u.group}</td>
                    <td>
                      <span style={{
                        background: u.role === "admin" ? "var(--accent)" : "var(--bg-3)",
                        color: u.role === "admin" ? "#000" : "var(--text)",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12
                      }}>{u.role}</span>
                    </td>
                    <td>
                      <span style={{
                        background: online ? "var(--ok)" : "var(--bg-3)",
                        color: online ? "#fff" : "var(--text-dim)",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12
                      }}>
                        {online ? "● Онлайн" : "○ Офлайн"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary"
                        style={{
                          width: "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          padding: "6px 12px"
                        }}
                        onClick={() => online ? startWatch(u.id) : showToast("Пользователь не стримит")}
                        disabled={!online}
                      >
                        <CameraIcon size={14} /> {online ? "Смотреть" : "Недоступен"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}