import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';

import { cleanDisplayName, contactLimits, validateContactPayload } from 'utils/contactValidation';
import { clientIp, createRateLimiter } from 'utils/rateLimit';

const senderEmail = 'portfolio@lewishadden.com';
const receiverEmail = 'lewishadden@gmail.com';
const emailSubject = 'New Portfolio Message';

// 5 messages per visitor per 10 minutes is generous for people and dull for bots
const rateLimit = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const json = (message: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ message }, { status, headers });

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(clientIp(request.headers));
  if (!allowed) {
    return json('Too many messages — please try again later', 429, {
      'Retry-After': String(retryAfterSeconds),
    });
  }

  const raw = await request.text();
  if (raw.length > contactLimits.body) return json('Message is too large', 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json('Invalid request body', 400);
  }

  const result = validateContactPayload(body);
  if (!result.ok) {
    return NextResponse.json(
      { message: 'Invalid submission', errors: result.errors },
      { status: 400 }
    );
  }

  // Honeypot filled or form submitted inhumanly fast: report success so bots
  // have no signal to adapt to, but send nothing.
  if (result.bot) return json('Email sent successfully', 200);

  const { SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_EMAIL || !SMTP_PASS) {
    console.error('Missing SMTP configuration environment variables');
    return json('Server configuration error', 500);
  }

  const { firstName, lastName, email, message } = result.data;
  const name = cleanDisplayName(`${firstName} ${lastName}`);

  try {
    const transporter = createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: false,
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASS,
      },
    });

    // Object-form addresses let nodemailer encode the visitor's name safely
    await transporter.sendMail({
      from: { name, address: senderEmail },
      sender: email,
      to: receiverEmail,
      replyTo: { name, address: email },
      subject: emailSubject,
      text: message,
    });

    return json('Email sent successfully', 200);
  } catch (error) {
    console.error('Error sending email:', error);
    return json('Error sending email', 500);
  }
}
