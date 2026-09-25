/**
 * Contact form rules shared by the client form (ContactForm) and the
 * /api/sendmail route, so the server enforces exactly what the UI promises.
 */
export const contactLimits = {
  name: 60,
  email: 254,
  message: 1000,
  /** Raw request body cap in bytes — far above any legitimate submission */
  body: 10_000,
  /** Submissions faster than this after the form mounted are treated as bots */
  minFillMs: 3000,
} as const;

/** Name of the visually hidden honeypot input; humans never fill it in */
export const honeypotField = 'company';

// Pragmatic check (same shape Yup's .email() accepts): something@domain.tld, no spaces
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
}

export type ContactValidation =
  | { ok: true; data: ContactPayload; bot: boolean }
  | { ok: false; errors: Partial<Record<keyof ContactPayload, string>> };

const asTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Strips control characters and characters with meaning in address headers */
export const cleanDisplayName = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f<>"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, contactLimits.name);

export function validateContactPayload(body: unknown, now = Date.now()): ContactValidation {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const data: ContactPayload = {
    firstName: asTrimmedString(input.firstName),
    lastName: asTrimmedString(input.lastName),
    email: asTrimmedString(input.email),
    message: asTrimmedString(input.message),
  };

  const errors: Partial<Record<keyof ContactPayload, string>> = {};
  if (!data.firstName) errors.firstName = 'First name is required';
  else if (data.firstName.length > contactLimits.name) errors.firstName = 'First name is too long';
  if (!data.lastName) errors.lastName = 'Last name is required';
  else if (data.lastName.length > contactLimits.name) errors.lastName = 'Last name is too long';
  if (!data.email) errors.email = 'Email is required';
  else if (data.email.length > contactLimits.email || !emailPattern.test(data.email))
    errors.email = 'Email address is invalid';
  if (!data.message) errors.message = 'Message is required';
  else if (data.message.length > contactLimits.message) errors.message = 'Message is too long';

  if (Object.keys(errors).length) return { ok: false, errors };

  const honeypot = asTrimmedString(input[honeypotField]);
  const startedAt = typeof input.startedAt === 'number' ? input.startedAt : NaN;
  const tooFast = !Number.isFinite(startedAt) || now - startedAt < contactLimits.minFillMs;

  return { ok: true, data, bot: honeypot.length > 0 || tooFast };
}
