import nodemailer from 'nodemailer';

function smtpConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function transporter() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendOtpEmail({ to, code, purpose }) {
  const client = transporter();
  if (!client) {
    const error = new Error('Gmail OTP is not configured on the server. Add GMAIL_USER and GMAIL_APP_PASSWORD to server/.env.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const isSignup = purpose === 'SIGNUP';
  const subject = isSignup ? 'Verify your Dev Portal email' : 'Reset your Dev Portal password';
  const action = isSignup ? 'finish creating your employee portal account' : 'reset your employee portal password';

  await client.sendMail({
    from: `Dev Employee Portal <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: `Your Dev Employee Portal verification code is ${code}. Use it within 10 minutes to ${action}. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#26322c">
        <h2 style="margin:0 0 10px">Dev Employee Portal</h2>
        <p>Use this verification code to ${action}:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:6px;padding:16px 0">${code}</div>
        <p>This code expires in 10 minutes.</p>
        <p style="color:#6d7872;font-size:13px">If you did not request this, you can ignore this message.</p>
      </div>
    `,
  });
}
