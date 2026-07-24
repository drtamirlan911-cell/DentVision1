const PHONE_RX = /\+?7\d{10}|8\d{10}/g;
const EMAIL_RX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DOB_RX = /\b\d{2}\.\d{2}\.\d{4}\b|\b\d{2}\/\d{2}\/\d{4}\b/g;
const IIN_RX = /\b\d{12}\b/g;

const NAME_SCRUB_RX = /[А-Яа-яA-Za-z]{2,}/g;
const MIN_NAME_LENGTH = 3;

const SCRUBBABLE_KEYS = new Set([
  'phone', 'phoneNumber', 'birthDate', 'birthday', 'iin', 'email', 'address',
  'firstName', 'lastName', 'fullName', 'name',
]);

export function scrubPII(text: string): string {
  let result = text
    .replace(PHONE_RX, (m) => {
      const digits = m.replace(/\D/g, '');
      if (digits.length === 11) {
        return digits.slice(0, 4) + '******' + digits.slice(8);
      }
      if (digits.length === 10) {
        return '******' + digits.slice(6);
      }
      return m;
    })
    .replace(EMAIL_RX, '***@***.com')
    .replace(DOB_RX, '**.**.****')
    .replace(IIN_RX, '************');
  return result;
}

export function scrubName(value: string): string {
  if (!value || value.length < MIN_NAME_LENGTH) return value;
  return value[0] + '*****';
}

const NAME_KEYS = new Set(['firstName', 'lastName', 'fullName', 'name']);

export function scrubToolOutput(data: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => scrubToolOutput(item));
  }
  if (typeof data === 'object') {
    const copy: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (NAME_KEYS.has(key)) {
        copy[key] = typeof value === 'string' ? scrubName(value) : value;
      } else if (SCRUBBABLE_KEYS.has(key)) {
        copy[key] = typeof value === 'string' ? scrubPII(value) : value;
      } else {
        copy[key] = scrubToolOutput(value);
      }
    }
    return copy;
  }
  return data;
}
