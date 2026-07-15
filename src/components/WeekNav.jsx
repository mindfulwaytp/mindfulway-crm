import { getMondayOf, shiftWeeks, formatWeekLabel, dateToStr } from '../lib/hourEntriesApi';

/**
 * Week picker for the hour log: arrows for stepping, a calendar for jumping.
 *
 * The date input accepts ANY day — picking Thursday snaps to that week's Monday —
 * so reaching an old week is one click instead of twenty presses of the back arrow.
 */
export default function WeekNav({ monday, onChange }) {
  const thisMonday = getMondayOf(new Date());
  const isCurrentWeek = dateToStr(monday) === dateToStr(thisMonday);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => onChange(shiftWeeks(monday, -1))} style={navBtnStyle} title="Previous week">←</button>

      <span style={{ fontWeight: 600, fontSize: 14, minWidth: 168, textAlign: 'center' }}>
        Week of {formatWeekLabel(monday)}
      </span>

      <button onClick={() => onChange(shiftWeeks(monday, 1))} style={navBtnStyle} title="Next week">→</button>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }} title="Jump to the week containing this date">
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Jump to</span>
        <input
          type="date"
          value={dateToStr(monday)}
          onChange={(e) => { if (e.target.value) onChange(getMondayOf(e.target.value)); }}
          style={{
            padding: '5px 8px', borderRadius: 8, border: '1px solid #d1d5db',
            fontSize: 13, color: '#111827', background: '#fff', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        />
      </label>

      {!isCurrentWeek && (
        <button onClick={() => onChange(thisMonday)} style={{ ...navBtnStyle, fontSize: 12, fontWeight: 600 }}>
          This week
        </button>
      )}
    </div>
  );
}

const navBtnStyle = {
  padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151',
};
