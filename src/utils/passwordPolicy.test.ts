import { describe, expect, it } from 'vitest'

import { passwordPolicyError, validatePassword } from './security'

/**
 * One policy, stated on both sides.
 *
 * The client used to accept six characters with no character requirement while
 * the server (`lib/password.ts::assertPasswordPolicy`) required eight with a
 * letter and a digit. A user typing `abcdef` passed the form and was refused by
 * the server, with no indication of which rule they had broken. These cases
 * pin the client to the server's rules; if the server's ever change, this file
 * is the reminder that two places have to move.
 */
describe('passwordPolicyError', () => {
  it('accepts a password that satisfies the server', () => {
    expect(passwordPolicyError('Passw0rd')).toBeNull()
    expect(passwordPolicyError('пароль123')).toBeNull()
  })

  it('rejects the six-character password the old client allowed', () => {
    expect(passwordPolicyError('abc123')).toMatch(/8 символов/)
  })

  it('requires both a letter and a digit, like the server does', () => {
    expect(passwordPolicyError('abcdefghi')).toMatch(/буквы и цифры/)
    expect(passwordPolicyError('123456789')).toMatch(/буквы и цифры/)
  })

  it('says something useful for an empty value', () => {
    expect(passwordPolicyError('')).toBe('Введите пароль')
    expect(passwordPolicyError(undefined)).toBe('Введите пароль')
  })

  it('refuses a password too long to be a password', () => {
    expect(passwordPolicyError('a1'.repeat(100))).toMatch(/длинный/)
  })

  it('keeps validatePassword agreeing with it', () => {
    // Other callers may still use the boolean form.
    for (const pw of ['Passw0rd', 'abc123', '', 'abcdefghi']) {
      expect(validatePassword(pw)).toBe(passwordPolicyError(pw) === null)
    }
  })
})
