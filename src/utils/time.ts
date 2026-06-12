import { Alarm } from '@/utils/alarm-store';

/**
 * Format hour and minute to 12-hour format with period (AM/PM)
 */
export function format12h(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return { time: `${h}:${String(minute).padStart(2, '0')}`, period };
}

/** Milliseconds until the next firing of an alarm, respecting its days. */
export function msUntil(alarm: Alarm, now: Date) {
  for (let d = 0; d < 8; d++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + d);
    candidate.setHours(alarm.hour, alarm.minute, 0, 0);
    const dayOk =
      alarm.days.length === 0 || alarm.days.includes(candidate.getDay());
    if (dayOk && candidate.getTime() > now.getTime()) {
      return candidate.getTime() - now.getTime();
    }
  }
  return Infinity;
}

export function nextAlarm(alarms: Alarm[], now: Date) {
  let best: { alarm: Alarm; ms: number } | null = null;
  for (const a of alarms) {
    if (!a.enabled) continue;
    const ms = msUntil(a, now);
    if (!best || ms < best.ms) best = { alarm: a, ms };
  }
  return best;
}

export function countdownLabel(ms: number) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `RINGS IN ${m} MIN`;
  return `RINGS IN ${h}H ${String(m).padStart(2, '0')}M`;
}

export function ringsIn(hour24: number, minute: number, days: number[], now: Date) {
  for (let d = 0; d < 8; d++) {
    const c = new Date(now);
    c.setDate(now.getDate() + d);
    c.setHours(hour24, minute, 0, 0);
    const dayOk = days.length === 0 || days.includes(c.getDay());
    if (dayOk && c.getTime() > now.getTime()) {
      const ms = c.getTime() - now.getTime();
      const totalMin = Math.round(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `RINGS IN ${m} MIN`;
      if (h < 24) return `RINGS IN ${h}H ${String(m).padStart(2, '0')}M`;
      const dd = Math.floor(h / 24);
      return `RINGS IN ${dd}D ${h % 24}H`;
    }
  }
  return '';
}

