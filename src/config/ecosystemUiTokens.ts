export const ECOSYSTEM_UI = {
  radius: { card: 'rounded-3xl', control: 'rounded-2xl', compact: 'rounded-xl' },
  surface: { page: 'bg-surface-0', card: 'bg-surface-1', nested: 'bg-surface-2' },
  border: 'border-bdr-subtle',
  accent: 'text-dv-gold',
  accentSoft: 'bg-dv-gold/10',
  muted: 'text-txt-muted',
  primary: 'text-txt-primary',
  transition: 'transition-colors duration-200',
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40',
} as const;

export type EcosystemUiToken = typeof ECOSYSTEM_UI;
