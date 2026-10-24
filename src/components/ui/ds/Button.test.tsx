import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Link, MemoryRouter } from 'react-router-dom'
import { Button } from './Button'

describe('Button asChild', () => {
  it('forwards design-system classes and icon content to the child link', () => {
    render(
      <MemoryRouter>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="min-h-11"
          icon={<span aria-hidden="true">calendar</span>}
        >
          <Link to="/patient-portal">Записаться онлайн</Link>
        </Button>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Записаться онлайн' })
    expect(link).toHaveAttribute('href', '/patient-portal')
    expect(link).toHaveClass('min-h-11')
    expect(link).toHaveClass('border-bdr-strong')
    expect(link).toHaveTextContent('Записаться онлайн')
    expect(link.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
