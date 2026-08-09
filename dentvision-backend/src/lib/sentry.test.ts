import { describe, expect, it } from 'vitest'
import {
  normalizeUrl,
  sanitizeBreadcrumb,
  sanitizeEvent,
} from './sentry.js'

function makeEvent() {
  return {
    event_id: 'event-1',
    request: {
      url: 'https://api.dentvision.kz/api/patients/123e4567-e89b-12d3-a456-426614174000/medical-history?x=1',
      method: 'POST',
      data: {
        iin: '900101400123',
        medicalHistory: 'аллергия на пенициллин',
        phone: '+77001234567',
        email: 'patient@example.com',
        patientName: 'Иванов Иван',
        password: 's3cr3t-pass',
        token: 'jwt-token-abc',
        idToken: 'id-token-xyz',
        credential: 'google-cred-42',
        nested: { patientName: 'Иванов Иван', phone: '+77001234567' },
        list: [{ iin: '900101400123' }, { keep: 'ok' }],
        firstName: 'Иван',
        keepMe: 'value',
      },
      cookies: { idToken: 'id-token-xyz', theme: 'dark' },
      headers: {
        authorization: 'Bearer secret-abc',
        cookie: 'session=abc123',
        'x-api-token': 'tok-123',
        idToken: 'id-token-xyz',
        'content-type': 'application/json',
        'x-request-id': 'req-1',
      },
    },
    extra: {
      iin: '900101400123',
      medicalHistory: 'аллергия на пенициллин',
      phone: '+77001234567',
      email: 'patient@example.com',
      patientName: 'Иванов Иван',
      password: 's3cr3t-pass',
      token: 'jwt-token-abc',
      authorization: 'Bearer secret-abc',
      cookie: 'session=abc123',
      idToken: 'id-token-xyz',
      credential: 'google-cred-42',
      someMeta: { patientName: 'Иванов Иван' },
      survived: 42,
    },
  } as never
}

describe('sanitizeEvent (beforeSend)', () => {
  it('strips every PHI key from request.data, extra, cookies and headers', () => {
    const event = sanitizeEvent(makeEvent())
    expect(event.request!.data).not.toHaveProperty('iin')
    expect(event.request!.data).not.toHaveProperty('medicalHistory')
    expect(event.request!.data).not.toHaveProperty('phone')
    expect(event.request!.data).not.toHaveProperty('email')
    expect(event.request!.data).not.toHaveProperty('patientName')
    expect(event.request!.data).not.toHaveProperty('password')
    expect(event.request!.data).not.toHaveProperty('token')
    expect(event.request!.data).not.toHaveProperty('idToken')
    expect(event.request!.data).not.toHaveProperty('credential')
    expect(event.extra).not.toHaveProperty('iin')
    expect(event.extra).not.toHaveProperty('phone')
    expect(event.extra).not.toHaveProperty('email')
    expect(event.extra).not.toHaveProperty('patientName')
    expect(event.extra).not.toHaveProperty('password')
    expect(event.extra).not.toHaveProperty('token')
    expect(event.extra).not.toHaveProperty('authorization')
    expect(event.extra).not.toHaveProperty('cookie')
    expect(event.extra).not.toHaveProperty('idToken')
    expect(event.extra).not.toHaveProperty('credential')
    expect(event.extra).not.toHaveProperty('medicalHistory')
    expect(event.request!.cookies).not.toHaveProperty('idToken')
    expect(event.request!.headers).not.toHaveProperty('authorization')
    expect(event.request!.headers).not.toHaveProperty('cookie')
    expect(event.request!.headers).not.toHaveProperty('x-api-token')
    expect(event.request!.headers).not.toHaveProperty('idToken')
  })

  it('recurses into nested objects and arrays', () => {
    const event = sanitizeEvent(makeEvent())
    const data = event.request!.data as { nested: Record<string, unknown>; list: Array<Record<string, unknown>> }
    expect(data.nested).not.toHaveProperty('patientName')
    expect(data.nested).not.toHaveProperty('phone')
    expect(data.list[0]).not.toHaveProperty('iin')
    expect(data.list[1]).toEqual({ keep: 'ok' })
    const extra = event.extra as { someMeta: Record<string, unknown> }
    expect(extra.someMeta).not.toHaveProperty('patientName')
  })

  it('leaves non-PHI data intact', () => {
    const event = sanitizeEvent(makeEvent())
    const data = event.request!.data as Record<string, unknown>
    expect(data.firstName).toBe('Иван')
    expect(data.keepMe).toBe('value')
    expect(data.list[1]).toEqual({ keep: 'ok' })
    const headers = event.request!.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-request-id']).toBe('req-1')
    const cookies = event.request!.cookies as Record<string, string>
    expect(cookies.theme).toBe('dark')
    expect(event.extra!.survived).toBe(42)
  })

  it('leaves no PHI value anywhere in the serialized event', () => {
    const json = JSON.stringify(sanitizeEvent(makeEvent()))
    expect(json).not.toMatch(/900101400123/)
    expect(json).not.toMatch(/\+77001234567/)
    expect(json).not.toMatch(/patient@example\.com/)
    expect(json).not.toMatch(/Иванов Иван/)
    expect(json).not.toMatch(/s3cr3t-pass/)
    expect(json).not.toMatch(/jwt-token-abc/)
    expect(json).not.toMatch(/id-token-xyz/)
    expect(json).not.toMatch(/google-cred-42/)
    expect(json).not.toMatch(/аллергия на пенициллин/)
    expect(json).not.toMatch(/Bearer secret-abc/)
    expect(json).not.toMatch(/session=abc123/)
    expect(json).not.toMatch(/tok-123/)
  })
})

describe('normalizeUrl', () => {
  it('replaces uuid path segments with :id', () => {
    expect(normalizeUrl('https://api.dentvision.kz/api/patients/123e4567-e89b-12d3-a456-426614174000/medical-history'))
      .toBe('https://api.dentvision.kz/api/patients/:id/medical-history')
  })

  it('replaces a trailing uuid', () => {
    expect(normalizeUrl('https://api.dentvision.kz/api/appointments/123e4567-e89b-12d3-a456-426614174000'))
      .toBe('https://api.dentvision.kz/api/appointments/:id')
  })

  it('replaces all uuid segments in a path', () => {
    expect(normalizeUrl('https://api.dentvision.kz/api/organizations/123e4567-e89b-12d3-a456-426614174000/members/123e4567-e89b-12d3-a456-426614174000'))
      .toBe('https://api.dentvision.kz/api/organizations/:id/members/:id')
  })

  it('leaves non-uuid urls unchanged', () => {
    expect(normalizeUrl('https://api.dentvision.kz/api/patients?search=ivanov'))
      .toBe('https://api.dentvision.kz/api/patients?search=ivanov')
  })

  it('handles undefined', () => {
    expect(normalizeUrl(undefined)).toBeUndefined()
  })
})

describe('sanitizeBreadcrumb (beforeBreadcrumb)', () => {
  it('drops request/response bodies from fetch breadcrumbs', () => {
    const crumb = sanitizeBreadcrumb({
      category: 'fetch',
      data: {
        url: '/api/patients',
        method: 'POST',
        request_body: '{"phone":"+77001234567"}',
        response_body: '{"patientName":"Иванов"}',
        status_code: 200,
      },
    })
    expect(crumb.data!.request_body).toBeUndefined()
    expect(crumb.data!.response_body).toBeUndefined()
    expect(crumb.data!.status_code).toBe(200)
  })

  it('drops request/response bodies from xhr breadcrumbs', () => {
    const crumb = sanitizeBreadcrumb({
      category: 'xhr',
      data: { request_body: 'x', response_body: 'y', status_code: 201 },
    })
    expect(crumb.data!.request_body).toBeUndefined()
    expect(crumb.data!.response_body).toBeUndefined()
    expect(crumb.data!.status_code).toBe(201)
  })

  it('leaves non-http breadcrumbs untouched', () => {
    const crumb = sanitizeBreadcrumb({
      category: 'ui.click',
      data: { request_body: 'x', response_body: 'y' },
    })
    expect(crumb.data!.request_body).toBe('x')
    expect(crumb.data!.response_body).toBe('y')
  })
})
