import { mailTransporter } from "../config/mail.config.js";
import { env } from "../config/env.js";

const sendEmail = async ({
  to,
  subject,
  html,
  text,
}) => {
  if (!to) {
    throw new Error("Recipient email is required");
  }

  const result = await mailTransporter.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text,
    html,
  });

  return result;
};

export const sendVerificationEmail = async ({
  email,
  fullname,
  code,
}) => {
  const subject = "Verify your GetTreat account";

  const text = `
Hello ${fullname || "there"},

Your GetTreat verification code is:

${code}

This code expires in ${env.verificationCodeExpiresMinutes} minutes.

If you did not create this account, you can safely ignore this email.

Regards,
GetTreat Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Verify your GetTreat account</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Welcome to GetTreat, ${fullname || "there"}!</h2>

  <p>
    Use the verification code below to verify your email address:
  </p>

  <div style="
    font-size: 32px;
    font-weight: bold;
    letter-spacing: 8px;
    margin: 25px 0;
  ">
    ${code}
  </div>

  <p>
    This code expires in
    <strong>${env.verificationCodeExpiresMinutes} minutes</strong>.
  </p>

  <p>
    If you did not create this account, you can safely ignore this email.
  </p>

  <p>
    Regards,<br />
    <strong>GetTreat Team</strong>
  </p>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};

export const sendPasswordResetEmail = async ({
  email,
  fullname,
  code,
}) => {
  const subject = "Reset your GetTreat password";

  const text = `
Hello ${fullname || "there"},

Your GetTreat password reset code is:

${code}

This code expires in ${env.verificationCodeExpiresMinutes} minutes.

If you did not request a password reset, please ignore this email.

Regards,
GetTreat Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Reset your GetTreat password</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Password Reset</h2>

  <p>
    Hello ${fullname || "there"},
  </p>

  <p>
    Use the code below to reset your GetTreat password:
  </p>

  <div style="
    font-size: 32px;
    font-weight: bold;
    letter-spacing: 8px;
    margin: 25px 0;
  ">
    ${code}
  </div>

  <p>
    This code expires in
    <strong>${env.verificationCodeExpiresMinutes} minutes</strong>.
  </p>

  <p>
    If you did not request this password reset, please ignore this email.
  </p>

  <p>
    Regards,<br />
    <strong>GetTreat Team</strong>
  </p>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
};