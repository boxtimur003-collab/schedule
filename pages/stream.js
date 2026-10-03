import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import {
  doc, setDoc, onSnapshot, addDoc, collection, query, where
} from "firebase/firestore";
import Layout from "../components/Layout";
import CameraIcon from "../components/icons/CameraIcon";

export default function Stream() {
  const [user, setUser] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pcRef = useRef(null);
  const unsubRef = useRef([]);
  const startedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return router.push("/");
    const u = JSON.parse(stored);
    setUser(u);
  }, []);

  // Автостарт: как только user загружен
  useEffect(() => {
    if (!user) return;
    if (startedRef.current) return;
    startedRef.current = true;
    autoStart();
  }, [user]);

  const autoStart = async () => {
    setStarting(true);
    setStatus("Проверка разрешений...");
    try {
      // Проверяем, есть ли уже разрешения
      if (navigator.permissions) {
        try {
          const cam = await navigator.permissions.query({ name: "camera" });
          if (cam.state === "denied") {
            setError("Доступ к камере запрещён. Открой настройки и разреши.");
            setStarting(false);
            return;
          }
        } catch (e) {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      await setDoc(doc(db, "streams", user.uid), {
        uid: user.uid,
        nick: user.nick,
        grade: user.grade,
        group: user.group,
        online: true,
        startedAt: new Date().toISOString()
      });

      listenForOffers();
      setStreaming(true);
      setStatus("Камера активна");
    } catch (e) {
      if (e.name === "NotAllowedError") {
        setError("Разрешение на камеру не выдано. Нажми «Включить камеру» и разреши.");
      } else {
        setError("Ошибка камеры: " + e.message);
      }
    }
    setStarting(false);
  };

  const listenForOffers = () => {
    const q = query(collection(db, "signals"), where("to", "==", user.uid), where("type", "==", "offer"));
    const unsub = onSnapshot(q, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        if (data.answered) continue;
        await handleOffer(data.from, data.sdp, d.id);
        await setDoc(doc(db, "signals", d.id), { ...data, answered: true });
      }
    });
    unsubRef.current.push(unsub);

    const qIce = query(collection(db, "signals"), where("to", "==", user.uid), where("type", "==", "ice"));
    const unsubIce = onSnapshot(qIce, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex
            });
          } catch (e) {}
        }
      }
    });
    unsubRef.current.push(unsubIce);
  };

  const handleOffer = async (adminUid, sdp, signalId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pcRef.current = pc;

    streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, "signals"), {
          from: user.uid,
          to: adminUid,
          type: "ice",
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          createdAt: new Date().toISOString()
        });
      }
    };

    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await addDoc(collection(db, "signals"), {
      from: user.uid,
      to: adminUid,
      type: "answer",
      sdp: answer.sdp,
      forSignal: signalId,
      createdAt: new Date().toISOString()
    });
  };

  const stopStream = async () => {
    unsubRef.current.forEach(u => u());
    unsubRef.current = [];
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
    setStatus("Камера выключена");
    if (user) {
      await setDoc(doc(db, "streams", user.uid), {
        online: false,
        stoppedAt: new Date().toISOString()
      }, { merge: true });
    }
  };

  useEffect(() => {
    return () => {
      unsubRef.current.forEach(u => u());
      if (pcRef.current) pcRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="topbar">
        <h1>Камера</h1>
        <div className="user-badge">
          {user.nick} <span className="role">{user.role}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              borderRadius: 8,
              background: "#000",
              minHeight: 300,
              display: streaming ? "block" : "none"
            }}
          />
          {!streaming && (
            <div style={{
              minHeight: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim)",
              flexDirection: "column",
              gap: 10
            }}>
              <CameraIcon size={48} />
              <p>{starting ? "Запуск камеры..." : "Камера выключена"}</p>
            </div>
          )}
        </div>

        {status && (
          <p style={{ textAlign: "center", color: "var(--text-dim)", marginBottom: 12 }}>
            {status}
          </p>
        )}

        {!streaming ? (
          <button onClick={autoStart} disabled={starting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CameraIcon /> {starting ? "Запуск..." : "Включить камеру"}
          </button>
        ) : (
          <button className="secondary" onClick={stopStream}>
            Выключить камеру
          </button>
        )}

        <p style={{ marginTop: 16, color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
          Камера включается автоматически, если разрешение уже дано. Она работает, пока приложение открыто. Если свернуть приложение, камера остановится.
        </p>
      </div>
    </Layout>
  );
}