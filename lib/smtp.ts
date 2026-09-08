import nodemailer from 'nodemailer';

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: Transporter | null | undefined;

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!smtpConfigured()) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

// Returns true when actually delivered. Without SMTP configured the
// caller keeps the notification row `pending` (visible in tracking).
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const smtp = getTransporter();
  if (!smtp) {
    console.log(`[notify:email:pending] to=${to} subject=${subject}`);
    return false;
  }
  try {
    await smtp.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('[notify:email:failed]', err);
    return false;
  }
}
