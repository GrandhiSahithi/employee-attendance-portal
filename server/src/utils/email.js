import { Resend } from 'resend';

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

let client = null;
function resendClient() {
  if (!emailConfigured()) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendOtpEmail({ to, code, purpose }) {
  const resend = resendClient();
  if (!resend) {
    const error = new Error('Email delivery is not configured on the server. Add RESEND_API_KEY to server/.env.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const isSignup = purpose === 'SIGNUP';
  const subject = isSignup ? 'Verify your Dev Portal email' : 'Reset your Dev Portal password';
  const action = isSignup ? 'finish creating your employee portal account' : 'reset your employee portal password';
  const from = process.env.RESEND_FROM || 'Dev Employee Portal <onboarding@resend.dev>';

  const { error } = await resend.emails.send({
    from,
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

  if (error) {
    const err = new Error(error.message || 'Failed to send verification email.');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }
}
