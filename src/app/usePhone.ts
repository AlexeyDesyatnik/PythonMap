import { useEffect, useState } from 'react';

/** Ширина, до которой экран считается телефонным; та же граница стоит в styles.css. */
const PHONE = '(max-width: 700px)';

/** Телефонный ли сейчас экран; меняется вместе с шириной окна. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}
