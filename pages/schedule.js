import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function Schedule() {
  const [userData, setUserData] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/');
      const uDoc = await getDoc(doc(db, 'users', user.uid));
      const u = uDoc.data();
      setUserData(u);
      const sDoc = await getDoc(doc(db, 'schedules', `${u.grade}-${u.group}`));
      setSchedule(sDoc.exists() ? sDoc.data() : {});
    });
    return () => unsub();
  }, []);

  if (!userData) return <p>Загрузка...</p>;

  return (
    <div>
      <h2>Расписание {userData.grade}-{userData.group}</h2>
      {schedule && Object.entries(schedule).map(([day, lessons]) => (
        <div key={day}>
          <h3>{day}</h3>
          <ul>{lessons.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}