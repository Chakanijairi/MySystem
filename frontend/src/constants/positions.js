// Shared list of member positions used across the admin pages, the register
// form, and the promotion visibility selector. Keep these four values in sync
// with the backend `member_category` column (free text) so a saved value
// always maps to a known label.

export const POSITIONS = [
  {
    value: 'executive',
    label: 'Executive',
    badge: 'bg-rose-100 text-rose-800',
    dot: 'bg-rose-500',
  },
  {
    value: 'director',
    label: 'Director',
    badge: 'bg-sky-100 text-sky-800',
    dot: 'bg-sky-500',
  },
  {
    value: 'manager',
    label: 'Manager',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  {
    value: 'member',
    label: 'Member',
    badge: 'bg-violet-100 text-violet-800',
    dot: 'bg-violet-500',
  },
]

export const POSITION_VALUES = POSITIONS.map((p) => p.value)

export function positionLabel(value) {
  if (!value) return ''
  const hit = POSITIONS.find((p) => p.value === String(value).toLowerCase())
  return hit ? hit.label : String(value)
}

export function positionBadgeClass(value) {
  const hit = POSITIONS.find((p) => p.value === String(value || '').toLowerCase())
  return hit ? hit.badge : 'bg-neutral-100 text-neutral-700'
}

// Promotion visibility options (audience targeting). Adds an "All Members"
// catch-all in front of the four positions, pluralized for readability.
export const PROMOTION_VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All Members' },
  ...POSITIONS.map((p) => ({
    value: `${p.value}s`,
    label: `${p.label}s Only`,
  })),
]

export function promotionVisibilityLabel(value) {
  const hit = PROMOTION_VISIBILITY_OPTIONS.find((o) => o.value === value)
  if (hit) return hit.label
  // Backwards-compat for legacy values such as `dealers` that may still be
  // persisted in localStorage.
  if (value && typeof value === 'string') {
    const pretty = value.charAt(0).toUpperCase() + value.slice(1)
    return `${pretty} Only`
  }
  return 'All Members'
}
