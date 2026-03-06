const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

/** Date en YYYY-MM-DD en heure locale (évite le décalage UTC qui fait surligner le mauvais jour). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getWeekDays(weekStart: Date): { date: Date; dateString: string; label: string; dayLabel: string }[] {
  const result: { date: Date; dateString: string; label: string; dayLabel: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dateString = toDateString(date);
    const dayLabel = DAY_LABELS[i];
    const dayNum = date.getDate();
    const month = MONTH_LABELS[date.getMonth()];
    result.push({
      date,
      dateString,
      label: `${dayLabel} ${dayNum}`,
      dayLabel: `${dayLabel} ${dayNum} ${month}`,
    });
  }
  return result;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function formatDayLong(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][day];
  return `${dayName} ${d} ${MONTH_LABELS[m - 1]} ${y}`;
}

export function isToday(dateString: string): boolean {
  return toDateString(new Date()) === dateString;
}
