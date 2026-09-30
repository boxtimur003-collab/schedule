import { useState } from "react";
import { auth, db, NICK_DOMAIN } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";

const GRADES = ["10А", "10Б", "10В", "10Г"];
const GROUPS = ["1", "2"];

export default function Register() {
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("10А");
  const [group, setGroup] = useState("1");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    try {
      const email = `${nick.toLowerCase()}@${NICK_DOMAIN}`;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const userData = { nick, email, grade, group, role: "student" };
      await setDoc(doc(db, "users", cred.user.uid), userData);
      localStorage.setItem("user", JSON.stringify({ uid: cred.user.uid, ...userData }));
      router.push("/schedule");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Такой ник уже занят");
      else setError(err.message);
    }
  };

  return (
    <div className="form-card">
      <h2>Регистрация</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleRegister}>
        <div className="field">
          <label>Ник</label>
          <input value={nick} onChange={e => setNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="timur" required />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 6 символов" required />
        </div>
        <div className="field">
          <label>Класс</label>
          <select value={grade} onChange={e => setGrade(e.target.value)}>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Группа</label>
          <select value={group} onChange={e => setGroup(e.target.value)}>
            {GROUPS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <button type="submit">Зарегистрироваться</button>
      </form>
      <div className="link-row">
        Уже есть аккаунт? <a href="/">Войти</a>
      </div>
    </div>
  );
}