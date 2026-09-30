import { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('5');
  const [group, setGroup] = useState('А');
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        grade,
        group,
        role: 'student'
      });
      router.push('/schedule');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <form onSubmit={handleRegister}>
      <h2>Регистрация</h2>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required />
      <label>Класс:
        <select value={grade} onChange={e => setGrade(e.target.value)}>
          {['5','6','7','8','9','10','11'].map(g => <option key={g}>{g}</option>)}
        </select>
      </label>
      <label>Группа:
        <select value={group} onChange={e => setGroup(e.target.value)}>
          {['А','Б','В'].map(g => <option key={g}>{g}</option>)}
        </select>
      </label>
      <button type="submit">Зарегистрироваться</button>
    </form>
  );
}