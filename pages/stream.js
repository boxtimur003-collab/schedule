import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../firebase";
import {
  doc, setDoc, onSnapshot, addDoc, collection, query, where
} from "firebase/firestore";
import Layout from "../components/Layout";
import CameraIcon from "../components/icons/CameraIcon";

// ICE-серверы: STUN + TURN (публичный OpenRelay для тестов)
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

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
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (startedRef.current) return;
    startedRef.current = true;
    autoStart();
  }, [user]);

  const autoStart = async () => {
    setError("");
    setStarting(true);
    setStatus("Запрос камеры...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Браузер не поддерживает камеру.");
      setStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: false
      });
      stream.getTracks().forEach(t => { t.enabled = true; });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

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
      setStatus("Камера активна, ожидание администратора");
    } catch (e) {
      if (e.name === "NotAllowedError") {
        setError("Разрешение на камеру отклонено. Разреши в настройках браузера.");
      } else if (e.name === "NotFoundError") {
        setError("Камера не найдена.");
      } else if (e.name === "NotReadableError") {
        setError("Камера занята другим приложением.");
      } else {
        setError("Ошибка: " + (e.message || e.name));
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
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    if (!streamRef.current) {
      setStatus("Камера отключена");
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) {
      setStatus("Нет видеотрека");
      return;
    }
    videoTrack.enabled = true;
    pc.addTrack(videoTrack, streamRef.current);

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

    pc.oniceconnectionstatechange = () => {
      console.log("stream ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setStatus("Стрим идёт");
      } else if (pc.iceConnectionState === "failed") {
        setStatus("Не удалось соединиться, пробую TURN");
      }
    };
    pc.onconnectionstatechange = () => {
      console.log("stream Conn:", pc.connectionState);
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
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", borderRadius: 8, background: "#000", minHeight: 300, display: streaming ? "block" : "none" }}
          />
          {!streaming && (
            <div style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", flexDirection: "column", gap: 10 }}>
              <CameraIcon size={48} />
              <p>{starting ? "Запуск камеры..." : "Камера выключена"}</p>
            </div>
          )}
        </div>

        {status && (
          <p style={{ textAlign: "center", color: "var(--text-dim)", marginBottom: 12 }}>{status}</p>
        )}

        {!streaming ? (
          <button onClick={autoStart} disabled={starting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CameraIcon /> {starting ? "Запуск..." : "Включить камеру"}
          </button>
        ) : (
          <button className="secondary" onClick={stopStream}>Выключить камеру</button>
        )}

        <p style={{ marginTop: 16, color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
          Держи приложение открытым и на переднем плане, пока идёт трансляция.
        </p>
      </div>
    </Layout>
  );
}