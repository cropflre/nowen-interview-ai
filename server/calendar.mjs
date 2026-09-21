// Store instants in UTC ISO 8601; use an explicit IANA zone only for calendar days.
// APP_TIME_ZONE defaults to Asia/Shanghai. Never change process.env.TZ globally.
const formatters = new Map();
export function calendarZone() {
  const zone = process.env.APP_TIME_ZONE || 'Asia/Shanghai';
  formatter(zone); // Fail fast for invalid timezone configuration.
  return zone;
}
function formatter(zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }));
  return formatters.get(zone);
}
export function calendarDay(instant = new Date(), zone = calendarZone()) {
  const parts = Object.fromEntries(formatter(zone).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function nextCalendarDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00.000Z`))) throw new Error('Invalid calendar day');
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + 86400000).toISOString().slice(0, 10);
}
function beginning(day, zone) {
  // Search the UTC timeline rather than assuming each local day is 24 hours.
  const midnight = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(midnight)) throw new Error('Invalid calendar day');
  let lower = midnight - 36 * 3600000;
  let upper = midnight + 36 * 3600000;
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    if (calendarDay(middle, zone) < day) lower = middle;
    else upper = middle;
  }
  if (calendarDay(upper, zone) !== day) throw new Error(`Calendar day ${day} unavailable in ${zone}`);
  return new Date(upper).toISOString();
}
export function calendarRange(instant = new Date(), zone = calendarZone()) {
  const day = calendarDay(instant, zone);
  return { day, start: beginning(day, zone), end: beginning(nextCalendarDay(day), zone), zone };
}
