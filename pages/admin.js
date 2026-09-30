import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function Admin() {
  const [allowed, setAllowed] = useState(false);
  const [grade, setGrade] = useState('5');
  const [group, setGroup] = useState('А');
  const [text, setText] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/');
      const u = await getDoc(doc(db, 'users', user.uid));
      if (u.data()?.role !== 'admin') return router.push('/schedule');
      setAllowed(true);
    });
    return () => unsub();
  }, []);

  const save = async () => {
    const days = {};
    text.split('\n\n').forEach(block => {
      const [day, ...lessons] = block.split('\n');
      days[day.trim()] = lessons.map(l => l.trim());
    });
    await setDoc(doc(db, 'schedules', `${grade}-${group}`), days);
    alert('Сохранено');
  };

  if (!allowed) return <p>Проверка доступа...</p>;

  return (
    <div>
      <h2>Редактирование расписания</h2>
      <select value={grade} onChange={e => setGrade(e.target.value)}>
        {['5','6','7','8','9','10','11'].map(g => <option key={g}>{g}</option>)}
      </select>
      <select value={group} onChange={e => setGroup(e.target.value)}>
        {['А','Б','В'].map(g => <option key={g}>{g}</option>)}
      </select>
      <p>Формат: день, затем каждый урок с новой строки. Пустая строка между днями.</p>
      <textarea rows="15" cols="60" value={text} onChange={e => setText(e.target.value)} />
      <button onClick={save}>Сохранить</button>
    </div>
  );
}