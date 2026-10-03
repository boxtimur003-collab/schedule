import { useState, useEffect } from "react";
import { auth, db, NICK_DOMAIN } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";
import { getAllClasses } from "../lib/classes";

export default function Register() {
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState("");
  const [group, setGroup] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const list = await getAllClasses();
      setClasses(list);
      if (list.length > 0) {
        setGrade(list[0].id);
        const groups = list[0].groups || [];
        setGroup(groups[0] || "1");
      }
    } catch (e) {
      setError("Не удалось загрузить классы: " + e.message);
    }
  };

  const currentGroups = classes.find(c => c.id === grade)?.groups || [];

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    if (!grade || !group) {
      setError("Выберите класс и группу");
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

  const onGradeChange = (g) => {
    setGrade(g);
    const groups = classes.find(c => c.id === g)?.groups || [];
    setGroup(groups[0] || "1");
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
          <select value={grade} onChange={e => onGradeChange(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Группа</label>
          <select value={group} onChange={e => setGroup(e.target.value)}>
            {currentGroups.map(g => <option key={g} value={g}>Группа {g}</option>)}
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