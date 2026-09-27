import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

// Emails sent while running tests, so tests can check them (never delivered).
export const testOutbox: Mail[] = [];

// Development and (for now) production: emails are written to the console.
// Setting SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM) switches to real SMTP.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail(mail: Mail) {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(mail);
    return;
  }
  if (!transport) {
    console.log(`[email] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...mail });
}
