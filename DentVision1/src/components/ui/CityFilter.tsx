import React from 'react'
import { MapPin } from 'lucide-react'
import { Select } from '@/components/ui/ds/Input'
import { KZ_CITY_FORM_OPTIONS, KZ_CITY_OPTIONS, KZ_POPULAR_CITIES } from '@/lib/kz-cities'
import { cn } from '@/lib/utils'

type CityFilterProps = {
  value: string
  onChange: (city: string) => void
  /** When true, empty value means "pick a city" (forms). Default: all-cities filter. */
  required?: boolean
  label?: string
  className?: string
  showPopularChips?: boolean
  size?: 'sm' | 'md'
}

/**
 * Kazakhstan city filter/select — popular chips + full catalog dropdown.
 */
export function CityFilter({
  value,
  onChange,
  required = false,
  label,
  className,
  showPopularChips = true,
  size = 'md',
}: CityFilterProps) {
  const options = required ? KZ_CITY_FORM_OPTIONS : KZ_CITY_OPTIONS
  const selected = value || ''

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-txt-muted">
          <MapPin size={12} className="text-dv-gold" />
          {label}
        </div>
      )}

      {showPopularChips && (
        <div className="flex flex-wrap gap-1.5">
          {!required && (
            <button
              type="button"
              onClick={() => onChange('')}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-2xs transition-colors',
                !selected
                  ? 'border-dv-gold/40 bg-dv-gold/15 text-dv-gold'
                  : 'border-bdr-subtle text-txt-muted hover:text-txt-primary hover:border-bdr-default',
              )}
            >
              Весь Казахстан
            </button>
          )}
          {KZ_POPULAR_CITIES.map((city) => (
            <button
              type="button"
              key={city}
              onClick={() => onChange(city === selected ? (required ? city : '') : city)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-2xs transition-colors',
                selected === city
                  ? 'border-dv-gold/40 bg-dv-gold/15 text-dv-gold'
                  : 'border-bdr-subtle text-txt-muted hover:text-txt-primary hover:border-bdr-default',
              )}
            >
              {city}
            </button>
          ))}
        </div>
      )}

      <Select
        label={showPopularChips ? undefined : label}
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        className={size === 'sm' ? 'text-xs' : undefined}
      />
    </div>
  )
}

export default CityFilter
