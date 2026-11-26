// Display helpers shared by several pages.

export const formatTime = (value, timeZone) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });

export const formatDateTime = (value, timeZone) =>
  new Date(value).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });

export const slotLabel = (slot) =>
  ({ 1: 'Semester 1', 2: 'Semester 2', YEAR: 'Year-long', EITHER: 'Either semester' })[slot] ?? slot;

export const creditsLabel = (credits) => (credits === null || credits === undefined ? 'Credits n/a' : `${credits} cr`);

export const initials = (first, last) => `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();

/** Today's date (YYYY-MM-DD) in the browser's timezone, for date inputs. */
export const todayInput = () => new Date().toLocaleDateString('en-CA');
