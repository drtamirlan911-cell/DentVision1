import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { LOGO_ICON, LOGO_WORDMARK } from './logoPaths';

export type LogoVariant = 'full' | 'compact' | 'icon' | 'wordmark';
export type LogoTheme = 'auto' | 'light' | 'dark' | 'mono';

export interface LogoProps {
  /** full = icon + wordmark + tagline · compact = icon + wordmark · icon · wordmark */
  variant?: LogoVariant;
  /** auto follows html.dark/.light; light/dark force palette; mono uses currentColor */
  theme?: LogoTheme;
  /** Pixel height of the mark; wordmark scales to match. Defaults per variant. */
  height?: number;
  className?: string;
  /** Accessible name. When the logo is a link, set this to the destination context. */
  title?: string;
  /** Hide the tooth on very small widths (full/compact collapse to wordmark). */
  responsive?: boolean;
}

/** Force palette for light/dark/mono by overriding the CSS vars locally. */
function themeVars(theme: LogoTheme): React.CSSProperties | undefined {
  if (theme === 'light') {
    return { ['--logo-from' as string]: '#1C3E6B', ['--logo-to' as string]: '#2AA4B4', ['--logo-ink' as string]: '#121A37', ['--logo-accent' as string]: '#157594', ['--logo-muted' as string]: '#5D6170' };
  }
  if (theme === 'dark') {
    return { ['--logo-from' as string]: '#7DB4D8', ['--logo-to' as string]: '#6FE3F0', ['--logo-ink' as string]: '#EAF2F8', ['--logo-accent' as string]: '#57CFE0', ['--logo-muted' as string]: '#9FB0C0' };
  }
  if (theme === 'mono') {
    return { ['--logo-from' as string]: 'currentColor', ['--logo-to' as string]: 'currentColor', ['--logo-ink' as string]: 'currentColor', ['--logo-accent' as string]: 'currentColor', ['--logo-muted' as string]: 'currentColor' };
  }
  return undefined; // auto → inherit tokens (flip with theme)
}

function ToothMark({ gradId, ...rest }: { gradId: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={LOGO_ICON.viewBox} role="presentation" aria-hidden="true" {...rest}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--logo-from)" />
          <stop offset="0.55" stopColor="var(--logo-accent, var(--logo-to))" />
          <stop offset="1" stopColor="var(--logo-to)" />
        </linearGradient>
      </defs>
      <path d={LOGO_ICON.d} fill={`url(#${gradId})`} fillRule="evenodd" />
    </svg>
  );
}

function Wordmark({ gradId, withTagline }: { gradId: string; withTagline: boolean }) {
  // Split viewBox so we can crop the tagline row out when withTagline is false.
  const [vx, vy, vw, vh] = LOGO_WORDMARK.viewBox.split(' ').map(Number);
  // Lettering occupies the upper ~78% of the wordmark box; tagline the lower ~22%.
  const letterH = withTagline ? vh : vh * 0.72;
  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${letterH}`} role="presentation" aria-hidden="true" style={{ height: '100%', width: 'auto' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.44" stopColor="var(--logo-ink)" />
          <stop offset="0.53" stopColor="var(--logo-accent)" />
          <stop offset="1" stopColor="var(--logo-accent)" />
        </linearGradient>
      </defs>
      <path d={LOGO_WORDMARK.lettering} fill={`url(#${gradId})`} />
      {withTagline && LOGO_WORDMARK.tagline ? (
        <path d={LOGO_WORDMARK.tagline} fill="var(--logo-muted)" />
      ) : null}
    </svg>
  );
}

const DEFAULT_HEIGHT: Record<LogoVariant, number> = { full: 40, compact: 30, icon: 32, wordmark: 26 };

export function Logo({
  variant = 'full',
  theme = 'auto',
  height,
  className,
  title = 'DentVision',
  responsive = true,
}: LogoProps) {
  const uid = useId().replace(/:/g, '');
  const h = height ?? DEFAULT_HEIGHT[variant];
  const style = { ...(themeVars(theme) || {}), maxWidth: 'var(--logo-max-width)' } as React.CSSProperties;

  const showIcon = variant !== 'wordmark';
  const showWord = variant !== 'icon';
  const withTagline = variant === 'full';

  return (
    <span
      role="img"
      aria-label={title}
      className={cn('dv-logo inline-flex select-none items-center', className)}
      style={style}
    >
      {showIcon && (
        <ToothMark
          gradId={`dvi-${uid}`}
          style={{ height: h, width: 'auto', display: 'block' }}
          className={cn(showWord && 'shrink-0')}
        />
      )}
      {showWord && (
        <span
          className={cn(
            'flex items-center',
            showIcon && 'ml-[0.5em]',
            // Responsive: collapse to icon-only on very narrow widths.
            responsive && showIcon && 'hidden min-[380px]:flex',
          )}
          style={{ height: Math.round(h * (withTagline ? 0.86 : 0.66)) }}
        >
          <Wordmark gradId={`dvw-${uid}`} withTagline={withTagline} />
        </span>
      )}
    </span>
  );
}

export default Logo;
