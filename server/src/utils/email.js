/**
 * Email Delivery (SendGrid)
 * =========================
 * Sends the OTP verification/password-reset emails used by utils/otp.js,
 * via the SendGrid API. Requires SENDGRID_API_KEY and SENDGRID_FROM to be
 * set (SENDGRID_FROM must be a Single Sender verified in your SendGrid
 * account); if either is missing, calls fail with an EMAIL_NOT_CONFIGURED
 * error instead of silently no-opping.
 */

import sgMail from '@sendgrid/mail';

function emailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);
}

let configured = false;
function sendgridClient() {
  if (!emailConfigured()) return null;
  if (!configured) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    configured = true;
  }
  return sgMail;
}

/**
 * Send a 6-digit OTP code to a user's email via SendGrid.
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.code - 6-digit OTP code to include in the email
 * @param {string} params.purpose - 'SIGNUP' or a password-reset purpose; only affects subject/body wording
 * @throws {Error} code 'EMAIL_NOT_CONFIGURED' if SendGrid isn't set up, or 'EMAIL_SEND_FAILED' if SendGrid returns an error
 */
export async function sendOtpEmail({ to, code, purpose }) {
  const mail = sendgridClient();
  if (!mail) {
    const error = new Error('Email delivery is not configured on the server. Add SENDGRID_API_KEY and SENDGRID_FROM to server/.env.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const isSignup = purpose === 'SIGNUP';
  const subject = isSignup ? 'Verify your Dev Portal email' : 'Reset your Dev Portal password';
  const action = isSignup ? 'finish creating your employee portal account' : 'reset your employee portal password';

  try {
    await mail.send({
      from: process.env.SENDGRID_FROM,
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
  } catch (error) {
    const err = new Error(error.response?.body?.errors?.[0]?.message || error.message || 'Failed to send verification email.');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }
}
