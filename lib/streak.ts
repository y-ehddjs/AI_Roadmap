function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function computeStreak(checkinDates: string[], today: Date): number {
  if (checkinDates.length === 0) return 0;
  const sorted = [...new Set(checkinDates)].sort();
  const todayStr = toDateOnly(today);
  const last = sorted[sorted.length - 1];
  const gapFromToday = daysBetween(last, todayStr);
  if (gapFromToday > 1) return 0;
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
