import { useEffect, useState } from 'react';

/** Live date and time for the check-in kiosk. */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="kiosk-clock" aria-hidden="true">
      <span className="time">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
    </div>
  );
}
