import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import Layout from "../components/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DownloadIcon from "../components/icons/DownloadIcon";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

// Длительность урока по умолчанию — 45 минут
const LESSON_DURATION = 45;

// Парсим строку урока: "08:30 Математика" → { time: "08:30", start: Date, end: Date, subject: "Математика" }
function parseLesson(line, baseDate) {
  const match = line.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
  if (!match) {
    return { time: null, subject: line, start: null, end: null };
  }
  const [, hh, mm, subject] = match;
  const start = new Date(baseDate);
  start.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  const end = new Date(start.getTime() + LESSON_DURATION * 60 * 1000);
  return {
    time: `${hh.padStart(2, "0")}:${mm}`,
    subject: subject.trim(),
    start,
    end
  };
}

export default function Schedule() {
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  // Тик каждую секунду — обновляем текущее время
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return router.push("/");
    const u = JSON.parse(stored);
    setUser(u);
    loadSchedule(u);
  }, []);

  const loadSchedule = async (u) => {
    const id = `${u.grade}-${u.group}`;
    const snap = await getDoc(doc(db, "schedules", id));
    setSchedule(snap.exists() ? snap.data() : {});
    setLoading(false);
  };

  // Определяем сегодняшний день недели
  const todayIndex = now.getDay(); // 0=Вс, 1=Пн...
  const todayName = todayIndex === 0 ? null : DAYS[todayIndex - 1];

  // Собираем уроки на сегодня с временем
  const todayLessons = (() => {
    if (!todayName || !schedule) return [];
    const raw = schedule[todayName] || [];
    return raw.map(l => parseLesson(l, now));
  })();

  // Текущий урок (start <= now < end)
  const currentLesson = todayLessons.find(l =>
    l.start && l.end && now >= l.start && now < l.end
  );

  // Следующий урок (start > now)
  const nextLesson = todayLessons.find(l => l.start && l.start > now);

  // Прогресс текущего урока (0..1)
  const progress = (() => {
    if (!currentLesson) return 0;
    const total = currentLesson.end - currentLesson.start;
    const elapsed = now - currentLesson.start;
    return Math.min(1, Math.max(0, elapsed / total));
  })();

  // Оставшиеся минуты до конца текущего урока
  const minutesLeft = currentLesson
    ? Math.max(0, Math.round((currentLesson.end - now) / 60000))
    : 0;

  // Минут до следующего урока
  const minutesToNext = nextLesson
    ? Math.max(0, Math.round((nextLesson.start - now) / 60000))
    : 0;

  const timeString = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateString = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const downloadPDF = async () => {
    try {
      const docPdf = new jsPDF({ unit: "pt", format: "a4" });
      const robotoRegular = await loadFont("/fonts/Roboto-Regular.ttf");
      const robotoBold = await loadFont("/fonts/Roboto-Bold.ttf");
      docPdf.addFileToVFS("Roboto-Regular.ttf", robotoRegular);
      docPdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      docPdf.addFileToVFS("Roboto-Bold.ttf", robotoBold);
      docPdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");

      docPdf.setFont("Roboto", "bold");
      docPdf.setFontSize(18);
      docPdf.text(`Расписание ${user.grade} — группа ${user.group}`, 40, 50);

      const body = DAYS.map(day => {
        const lessons = schedule[day] || [];
        return [day, lessons.length === 0 ? "—" : lessons.join("\n")];
      });

      autoTable(docPdf, {
        startY: 80,
        head: [["День", "Уроки"]],
        body,
        styles: { font: "Roboto", fontSize: 12, cellPadding: 8 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [255, 122, 24], textColor: 0 },
        columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: "auto" } },
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
        <h1>Расписание {user.grade} — группа {user.group}</h1>
        <button className="secondary" style={{ width: "auto", display: "flex", alignItems: "center", gap: 8 }} onClick={downloadPDF}>
          <DownloadIcon /> Скачать PDF
        </button>
      </div>

      {/* Блок текущего времени */}
      <div className="now-panel">
        <div className="now-time">{timeString}</div>
        <div className="now-date">{DAYS_SHORT[todayIndex]}, {dateString}</div>
      </div>

      {/* Сейчас идёт */}
      {currentLesson ? (
        <div className="lesson-now">
          <div className="lesson-label">СЕЙЧАС ИДЁТ</div>
          <div className="lesson-title">{currentLesson.subject}</div>
          <div className="lesson-time">{currentLesson.time} — {currentLesson.end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
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
            <div className="lesson-meta">Через {minutesToNext} мин · в {nextLesson.time}</div>
          )}
        </div>
      )}

      {/* Следующий урок */}
      {currentLesson && nextLesson && (
        <div className="lesson-next">
          <span className="lesson-next-label">Следующий:</span>
          <strong>{nextLesson.subject}</strong>
          <span className="lesson-next-time">в {nextLesson.time} · через {minutesToNext} мин</span>
        </div>
      )}

      {/* Полное расписание на сегодня */}
      {todayName && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, color: "var(--accent)" }}>
            Расписание на {todayName.toLowerCase()}
          </h2>
          <div className="day-list">
            {todayLessons.length === 0 && (
              <p style={{ color: "var(--text-dim)" }}>Уроков нет</p>
            )}
            {todayLessons.map((lesson, i) => {
              const isCurrent = currentLesson && currentLesson.subject === lesson.subject && currentLesson.time === lesson.time;
              const isPast = lesson.end && now >= lesson.end;
              return (
                <div
                  key={i}
                  className={`lesson-row ${isCurrent ? "current" : ""} ${isPast ? "past" : ""}`}
                >
                  <div className="lesson-row-time">{lesson.time || "—"}</div>
                  <div className="lesson-row-subject">{lesson.subject}</div>
                  {isCurrent && <div className="lesson-row-badge">Сейчас</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Полное расписание на неделю */}
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
                    {lessons.map((l, i) => <li key={i}>{l}</li>)}
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