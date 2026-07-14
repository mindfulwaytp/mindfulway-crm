import { DAYS, SLOTS, hasSlot, toggleSlot, toggleDay, toggleSlotColumn, availableDayKeys } from '../lib/availability';

/**
 * Day × time-slot checkbox grid.
 *
 * Full mode  — the profile editor: a labelled matrix with row/column bulk toggles.
 * Compact mode — one provider row in a table: three M/A/E pills per day column.
 */
export default function AvailabilityGrid({ grid, onChange, readOnly = false }) {
  const set = (next) => { if (!readOnly) onChange(next); };
  const allDays = availableDayKeys(grid);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(96px, 1.2fr) repeat(${SLOTS.length}, minmax(72px, 1fr))`, gap: 4 }}>
        {/* Header row — click a slot to toggle it on every day */}
        <div />
        {SLOTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => set(toggleSlotColumn(grid, s.key))}
            disabled={readOnly}
            title={readOnly ? undefined : `Toggle ${s.label} on every day`}
            style={headerBtnStyle(readOnly)}
          >
            <span style={{ fontWeight: 700, fontSize: 11, color: '#374151' }}>{s.label}</span>
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>{s.hint}</span>
          </button>
        ))}

        {/* One row per day — click the name to toggle the whole day */}
        {DAYS.map((d) => {
          const active = (grid?.[d.key] || []).length > 0;
          return (
            <Row key={d.key}>
              <button
                type="button"
                onClick={() => set(toggleDay(grid, d.key))}
                disabled={readOnly}
                title={readOnly ? undefined : `Toggle all of ${d.label}`}
                style={{
                  ...dayBtnStyle(readOnly),
                  color: active ? '#111827' : '#9ca3af',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {d.label}
              </button>
              {SLOTS.map((s) => {
                const on = hasSlot(grid, d.key, s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => set(toggleSlot(grid, d.key, s.key))}
                    disabled={readOnly}
                    aria-pressed={on}
                    aria-label={`${d.label} ${s.label}`}
                    style={cellStyle(on, readOnly)}
                  >
                    {on ? '✓' : ''}
                  </button>
                );
              })}
            </Row>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
        {allDays.length === 0
          ? 'No availability set — this provider will not match any inquiry on day/time.'
          : 'Click a day name or a column header to toggle a whole row or column.'}
      </div>
    </div>
  );
}

/** `display: contents` lets the row's children land directly in the parent grid. */
function Row({ children }) {
  return <div style={{ display: 'contents' }}>{children}</div>;
}

/**
 * Three M/A/E pills for a single day — used inside the availability table,
 * where each day is its own column.
 */
export function DayCell({ grid, day, onToggle, readOnly = false }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      {SLOTS.map((s) => {
        const on = hasSlot(grid, day, s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => !readOnly && onToggle(day, s.key)}
            disabled={readOnly}
            title={`${s.label} (${s.hint})`}
            aria-pressed={on}
            style={{
              width: 20, height: 20, borderRadius: 5, fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${on ? '#3a93ed' : '#e5e7eb'}`,
              background: on ? '#3a93ed' : '#fff',
              color: on ? '#fff' : '#9ca3af',
              cursor: readOnly ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            {s.short}
          </button>
        );
      })}
    </div>
  );
}

function headerBtnStyle(readOnly) {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
    padding: '6px 4px', borderRadius: 8, border: '1px solid transparent',
    background: 'transparent', cursor: readOnly ? 'default' : 'pointer',
  };
}

function dayBtnStyle(readOnly) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
    padding: '8px 10px', borderRadius: 8, border: '1px solid transparent',
    background: 'transparent', fontSize: 13,
    cursor: readOnly ? 'default' : 'pointer', textAlign: 'left',
  };
}

function cellStyle(on, readOnly) {
  return {
    height: 34, borderRadius: 8, fontSize: 14, fontWeight: 700,
    border: `1px solid ${on ? '#3a93ed' : '#e5e7eb'}`,
    background: on ? '#ede9fe' : '#fff',
    color: on ? '#1a9742' : 'transparent',
    cursor: readOnly ? 'default' : 'pointer',
    transition: 'background 0.12s, border-color 0.12s',
  };
}
