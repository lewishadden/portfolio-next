import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';

const senderEmail = 'portfolio@lewishadden.com';
const receiverEmail = 'lewishadden@gmail.com';
const emailSubject = 'New Portfolio Message';

export async function POST(request: NextRequest) {
  const { firstName, lastName, email, message } = await request.json();

  if (!firstName || !lastName || !email || !message) {
    return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_EMAIL || !SMTP_PASS) {
    console.error('Missing SMTP configuration environment variables');
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
  }

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

    await transporter.sendMail({
      from: `${firstName} ${lastName} <${senderEmail}>`,
      sender: email,
      to: receiverEmail,
      replyTo: email,
      subject: emailSubject,
      text: message,
    });

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ message: 'Error sending email' }, { status: 500 });
  }
}
