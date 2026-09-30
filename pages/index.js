import { useState } from "react";
import { auth, db, NICK_DOMAIN } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function Login() {
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Подменяем ник на служебную почту
      const email = `${nick.toLowerCase()}@${NICK_DOMAIN}`;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uDoc = await getDoc(doc(db, "users", cred.user.uid));
      const userData = uDoc.data();
      localStorage.setItem("user", JSON.stringify({ uid: cred.user.uid, ...userData }));
      if (userData.role === "admin") router.push("/admin");
      else router.push("/schedule");
    } catch (err) {
      setError("Неверный ник или пароль");
    }
  };

  return (
    <div className="form-card">
      <h2>Вход</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleLogin}>
        <div className="field">
          <label>Ник</label>
          <input value={nick} onChange={e => setNick(e.target.value)} placeholder="Например: timur" required />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button type="submit">Войти</button>
      </form>
      <div className="link-row">
        Нет аккаунта? <a href="/register">Зарегистрироваться</a>
      </div>
    </div>
  );
}