import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import {
  doc, setDoc, onSnapshot, collection, query, where, addDoc
} from "firebase/firestore";
import Layout from "../components/Layout";
import CameraIcon from "../components/icons/CameraIcon";

export default function Watch() {
  const [user, setUser] = useState(null);
  const [streams, setStreams] = useState([]);
  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState("");
  const router = useRouter();
  const pcRef = useRef(null);
  const unsubsRef = useRef([]);
  const videoRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return router.push("/");
    const u = JSON.parse(stored);
    if (u.role !== "admin") return router.push("/schedule");
    setUser(u);

    const unsub = onSnapshot(collection(db, "streams"), (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.online) list.push({ id: d.id, ...data });
      });
      setStreams(list);
    });
    return () => unsub();
  }, []);

  const startWatching = async (targetUid) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setTarget(targetUid);
    setStatus("Установка соединения...");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      setStatus("Получение видео...");
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(() => {});
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

    const offer = await pc.createOffer({ offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);

    await addDoc(collection(db, "signals"), {
      from: user.uid,
      to: targetUid,
      type: "offer",
      sdp: offer.sdp,
      createdAt: new Date().toISOString()
    });

    setStatus("Ожидание ответа...");

    // Слушаем answer
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
          setStatus("Видео подключено");
        }
      }
    });
    unsubsRef.current.push(unsubAnswer);

    // Слушаем ICE от target
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

  const stopWatching = () => {
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setTarget(null);
    setStatus("");
  };

  useEffect(() => {
    return () => {
      unsubsRef.current.forEach(u => u());
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>Просмотр камер</h1>
        <div className="user-badge">
          {user.nick} <span className="role">admin</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        <div>
          <h3 style={{ color: "var(--accent)", marginBottom: 12 }}>Онлайн: {streams.length}</h3>
          {streams.length === 0 && (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Никто не стримит</p>
          )}
          {streams.map(s => (
            <div
              key={s.id}
              onClick={() => startWatching(s.id)}
              style={{
                padding: 12,
                background: target === s.id ? "var(--bg-3)" : "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                marginBottom: 8,
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CameraIcon size={16} />
                <strong>{s.nick}</strong>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                {s.grade} / группа {s.group}
              </div>
            </div>
          ))}
        </div>

        <div>
          {target ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: "100%", borderRadius: 12, background: "#000", minHeight: 400 }}
              />
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{status}</p>
              <button className="secondary" onClick={stopWatching} style={{ marginTop: 12 }}>
                Остановить просмотр
              </button>
            </>
          ) : (
            <div style={{
              minHeight: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim)",
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              borderRadius: 12
            }}>
              Выбери пользователя слева
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}