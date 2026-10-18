import { cx } from '../ui/index.jsx';

const surname = (name) => name.split(' ').at(-1);

/** A top-down pitch with one button per slot of the formation. */
export default function Pitch({ slots, lineup, playersById, selectedSlot, onSelect, readOnly }) {
  return (
    <div
      role="group"
      aria-label="Formation pitch"
      className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl border border-line bg-gradient-to-b from-win/25 to-win/10"
    >
      {/* Markings are decoration only. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-chalk/15" />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-chalk/15"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[22%] bottom-0 h-[16%] rounded-t-md border border-b-0 border-chalk/15"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[22%] top-0 h-[16%] rounded-b-md border border-t-0 border-chalk/15"
      />

      {slots.map((slot, index) => {
        const player = playersById.get(lineup[index]);
        const description = player ? `${player.name}, rated ${player.rating}` : 'empty';

        return (
          <button
            key={index}
            type="button"
            disabled={readOnly}
            onClick={() => onSelect(index)}
            aria-label={`${slot.label}: ${description}`}
            aria-pressed={selectedSlot === index}
            className="group absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 disabled:cursor-default"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <span
              className={cx(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-lg leading-none transition-colors',
                player
                  ? 'border-flood bg-turf-900 text-flood'
                  : 'border-dashed border-chalk/40 bg-turf-900/60 text-chalk/60',
                !readOnly && 'group-hover:border-chalk'
              )}
            >
              {player ? player.rating : '+'}
            </span>
            <span className="max-w-full truncate rounded bg-turf-900/80 px-1.5 text-[11px] leading-5">
              {player ? surname(player.name) : slot.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
