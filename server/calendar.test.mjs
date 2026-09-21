import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDay, calendarRange, nextCalendarDay } from './calendar.mjs';

test('Shanghai calendar does not reset at UTC midnight', () => {
  assert.equal(calendarDay('2026-09-20T15:59:59.999Z','Asia/Shanghai'), '2026-09-20');
  assert.equal(calendarDay('2026-09-20T16:00:00.000Z','Asia/Shanghai'), '2026-09-21');
  assert.deepEqual(calendarRange('2026-09-21T03:00:00Z','Asia/Shanghai'), {
    day:'2026-09-21', start:'2026-09-20T16:00:00.000Z', end:'2026-09-21T16:00:00.000Z', zone:'Asia/Shanghai',
  });
});
test('IANA boundaries honor DST days of 23 and 25 hours', () => {
  const spring=calendarRange('2026-03-08T12:00:00Z','America/Los_Angeles');
  assert.equal(Date.parse(spring.end)-Date.parse(spring.start),23*3600000);
  const fall=calendarRange('2026-11-01T12:00:00Z','America/Los_Angeles');
  assert.equal(Date.parse(fall.end)-Date.parse(fall.start),25*3600000);
  assert.equal(nextCalendarDay('2026-12-31'),'2027-01-01');
});
test('invalid IANA timezone is rejected',()=>{
  assert.throws(()=>calendarDay(new Date(),'Not/A_Zone'),RangeError);
});
