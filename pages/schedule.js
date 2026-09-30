import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import Layout from "../components/Layout";
import jsPDF from "jspdf";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export default function Schedule() {
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  const downloadPDF = () => {
    const docPdf = new jsPDF();
    docPdf.setFontSize(18);
    docPdf.text(`Расписание ${user.grade} — группа ${user.group}`, 20, 20);
    docPdf.setFontSize(12);
    let y = 40;
    DAYS.forEach(day => {
      const lessons = schedule[day] || [];
      docPdf.setFont(undefined, "bold");
      docPdf.text(day, 20, y);
      y += 7;
      docPdf.setFont(undefined, "normal");
      if (lessons.length === 0) {
        docPdf.text("—", 25, y);
        y += 7;
      } else {
        lessons.forEach((l, i) => {
          docPdf.text(`${i + 1}. ${l}`, 25, y);
          y += 7;
        });
      }
      y += 5;
    });
    docPdf.save(`schedule-${user.grade}-${user.group}.pdf`);
  };

  if (!user || loading) return null;

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>Расписание {user.grade} — группа {user.group}</h1>
        <button className="secondary" style={{ width: "auto" }} onClick={downloadPDF}>
          📄 Скачать PDF
        </button>
      </div>

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
                  {lessons.map((l, i) => <li key={i}>{i + 1}. {l}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}