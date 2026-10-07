import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import Layout from "../components/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DownloadIcon from "../components/icons/DownloadIcon";
import { loadProfile, loadUser } from "../lib/storage";
import { getTimeSlots } from "../lib/slots";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

export default function Schedule() {
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshUser();

    // Подписка на событие profile-changed
    const handler = () => refreshUser();
    window.addEventListener("profile-changed", handler);
    return () => window.removeEventListener("profile-changed", handler);
  }, []);

  const refreshUser = () => {
    const stored = loadUser();
    const profile = loadProfile();

    let u = stored;
    if (!u && profile) {
      u = {
        nick: profile.nick || "Гость",
        grade: profile.grade,
        group: profile.group,
        role: "student",
        guest: true
      };
    }
    if (!u || !u.grade || !u.group) {
      router.push("/");
      return;
    }
    setUser(u);
    loadAll(u);
  };

  const loadAll = async (u) => {
    setLoading(true);
    try {
      const id = `${u.grade}-${u.group}`;
      const [snap, timeSlots] = await Promise.all([
        getDoc(doc(db, "schedules", id)),
        getTimeSlots()
      ]);
      setSchedule(snap.exists() ? snap.data() : {});
      setSlots(timeSlots);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const todayIndex = now.getDay();
  const todayName = todayIndex === 0 ? null : DAYS[todayIndex - 1];

  const todayLessons = (() => {
    if (!todayName || !schedule) return [];
    const raw = schedule[todayName] || [];
    return raw.map(item => {
      const slotData = slots.find(s => s.slot === item.slot);
      if (!slotData) return { ...item, time: null, start: null, end: null };
      const [sh, sm] = slotData.start.split(":").map(Number);
      const [eh, em] = slotData.end.split(":").map(Number);
      const start = new Date(now); start.setHours(sh, sm, 0, 0);
      const end = new Date(now); end.setHours(eh, em, 0, 0);
      return { ...item, time: `${slotData.start}–${slotData.end}`, start, end };
    });
  })();

  const currentLesson = todayLessons.find(l => l.start && l.end && now >= l.start && now < l.end);
  const nextLesson = todayLessons.find(l => l.start && l.start > now);
  const progress = currentLesson
    ? Math.min(1, Math.max(0, (now - currentLesson.start) / (currentLesson.end - currentLesson.start)))
    : 0;
  const minutesLeft = currentLesson ? Math.max(0, Math.round((currentLesson.end - now) / 60000)) : 0;
  const minutesToNext = nextLesson ? Math.max(0, Math.round((nextLesson.start - now) / 60000)) : 0;

  const timeString = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateString = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const downloadPDF = async () => {
    try {
      const docPdf = new jsPDF({ unit: "pt", format: "a4" });
      const r = await loadFont("/fonts/Roboto-Regular.ttf");
      const b = await loadFont("/fonts/Roboto-Bold.ttf");
      docPdf.addFileToVFS("Roboto-Regular.ttf", r);
      docPdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      docPdf.addFileToVFS("Roboto-Bold.ttf", b);
      docPdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
      docPdf.setFont("Roboto", "bold");
      docPdf.setFontSize(18);
      docPdf.text(`Расписание ${user.grade} — группа ${user.group}`, 40, 50);

      const body = DAYS.map(day => {
        const lessons = schedule[day] || [];
        return [day, lessons.length === 0 ? "—" : lessons.map(l => {
          const s = slots.find(x => x.slot === l.slot);
          const t = s ? `${s.start}–${s.end}` : "";
          const extra = l.extra ? " (доп.)" : "";
          return `${t} ${l.subject}${extra}`;
        }).join("\n")];
      });

      autoTable(docPdf, {
        startY: 80,
        head: [["День", "Уроки"]],
        body,
        styles: { font: "Roboto", fontSize: 11, cellPadding: 6 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [255, 122, 24], textColor: 0 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: "auto" } },
        theme: "grid"
      });

      docPdf.save(`schedule-${user.grade}-${user.group}.pdf`);
    } catch (e) {
      alert("Ошибка PDF: " + e.message);
    }
  };

  const loadFont = async (url) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  if (!user || loading) return null;

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>{user.grade} — группа {user.group}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/settings" className="btn secondary" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            ⚙ Настройки
          </a>
          <button className="secondary" style={{ width: "auto", display: "flex", alignItems: "center", gap: 8 }} onClick={downloadPDF}>
            <DownloadIcon /> PDF
          </button>
        </div>
      </div>

      <div className="now-panel">
        <div className="now-time">{timeString}</div>
        <div className="now-date">{DAYS_SHORT[todayIndex]}, {dateString}</div>
      </div>

      {currentLesson ? (
        <div className="lesson-now">
          <div className="lesson-label">СЕЙЧАС ИДЁТ</div>
          <div className="lesson-title">
            {currentLesson.subject}
            {currentLesson.extra && <span style={{ fontSize: 14, marginLeft: 8, opacity: 0.8 }}>(доп.)</span>}
          </div>
          <div className="lesson-time">{currentLesson.time}</div>
          {currentLesson.note && <div className="lesson-note">📌 {currentLesson.note}</div>}
          <div className="lesson-progress">
            <div className="lesson-progress-bar" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="lesson-meta">Осталось: {minutesLeft} мин</div>
        </div>
      ) : (
        <div className="lesson-none">
          <div className="lesson-label">СЕЙЧАС УРОКОВ НЕТ</div>
          <div className="lesson-title">
            {nextLesson ? `Следующий: ${nextLesson.subject}` : "Уроков не осталось"}
          </div>
          {nextLesson && (
            <div className="lesson-meta">Через {minutesToNext} мин · в {nextLesson.time.split("–")[0]}</div>
          )}
        </div>
      )}

      {currentLesson && nextLesson && (
        <div className="lesson-next">
          <span className="lesson-next-label">Следующий:</span>
          <strong>{nextLesson.subject}</strong>
          <span className="lesson-next-time">в {nextLesson.time.split("–")[0]} · через {minutesToNext} мин</span>
        </div>
      )}

      {todayName && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, color: "var(--accent)" }}>
            Расписание на {todayName.toLowerCase()}
          </h2>
          <div className="day-list">
            {todayLessons.length === 0 && <p style={{ color: "var(--text-dim)", padding: 16 }}>Уроков нет</p>}
            {todayLessons.map((lesson, i) => {
              const isCurrent = currentLesson && currentLesson.slot === lesson.slot;
              const isPast = lesson.end && now >= lesson.end;
              return (
                <div key={i} className={`lesson-row ${isCurrent ? "current" : ""} ${isPast ? "past" : ""}`}>
                  <div className="lesson-row-time">{lesson.time || "—"}</div>
                  <div className="lesson-row-subject">
                    {lesson.subject}
                    {lesson.extra && <span style={{ fontSize: 12, color: "var(--accent)", marginLeft: 8 }}>доп.</span>}
                    {lesson.note && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>📌 {lesson.note}</div>}
                  </div>
                  {isCurrent && <div className="lesson-row-badge">Сейчас</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, color: "var(--accent)" }}>Вся неделя</h2>
        <div className="schedule-grid">
          {DAYS.map(day => {
            const lessons = schedule?.[day] || [];
            return (
              <div className="day-card" key={day}>
                <h3>{day}</h3>
                {lessons.length === 0 ? (
                  <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Нет уроков</p>
                ) : (
                  <ul>
                    {lessons.map((l, i) => {
                      const s = slots.find(x => x.slot === l.slot);
                      const time = s ? s.start : "";
                      return (
                        <li key={i}>
                          <span style={{ color: "var(--text-dim)", marginRight: 8 }}>{time}</span>
                          {l.subject}
                          {l.extra && <span style={{ color: "var(--accent)", fontSize: 12, marginLeft: 6 }}>доп.</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}