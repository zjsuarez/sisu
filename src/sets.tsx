import type { Effort } from './store'

/** RIR and RPE are the same box with a different name over it; 'none' hides it. */
export const effortLabel = (effort: Effort) => (effort === 'rpe' ? 'RPE' : 'RIR')

/**
 * A number you type or leave empty. Empty is `undefined`, not 0, because 0 RIR means
 * "went to failure" and has to survive a reload.
 */
export function NumInput({
  value,
  onChange,
  step,
  label,
  hint = '0',
  className = '',
}: {
  value: number | undefined
  onChange: (n: number | undefined) => void
  step: number
  label: string
  hint?: string
  className?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={0}
      step={step}
      value={value ?? ''}
      placeholder={hint}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0))}
      className={`h-11 w-full rounded-xl bg-surface-2 text-center font-display text-lg font-semibold tabular-nums outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-accent ${className}`}
    />
  )
}
