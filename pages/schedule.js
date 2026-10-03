import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import Layout from "../components/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DownloadIcon from "../components/icons/DownloadIcon";

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

  const loadFont = async (url) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

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
        return [day, lessons.length === 0 ? "—" : lessons.map((l, i) => `${i + 1}. ${l}`).join("\n")];
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
      console.error(e);
      alert("Ошибка PDF: " + e.message);
    }
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
      <div className="schedule-grid">
        {DAYS.map(day => {
          const lessons = schedule?.[day] || [];
          return (
            <div className="day-card" key={day}>
              <h3>{day}</h3>
              {lessons.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Нет уроков</p>
              ) : (
                <ul>{lessons.map((l, i) => <li key={i}>{i + 1}. {l}</li>)}</ul>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}