import nodemailer from "nodemailer";

interface TransferEmailData {
  id: string;
  title: string | null;
  message: string | null;
  senderEmail: string | null;
  fileCount: number;
  totalSize: bigint;
  expiresAt: Date;
}

function formatBytes(bytes: bigint): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0n) return "0 Bytes";
  const i = Math.floor(Math.log(Number(bytes)) / Math.log(1024));
  return (
    parseFloat((Number(bytes) / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i]
  );
}

function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendDownloadNotification(
  transfer: TransferEmailData,
  recipientEmails: string[]
): Promise<void> {
  const transporter = getEmailTransporter();

  if (!transporter) {
    console.log("SMTP not configured, skipping email notification");
    return;
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const downloadUrl = `${baseUrl}/download/${transfer.id}`;
  const fromAddress = process.env.SMTP_FROM || "noreply@transfer.local";

  const subject = transfer.title
    ? `Files shared with you: ${transfer.title}`
    : "Files shared with you";

  const senderName = transfer.senderEmail || "Someone";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Files Shared With You</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                <strong>${senderName}</strong> has shared files with you.
              </p>

              ${transfer.title ? `<p style="margin: 0 0 10px; color: #333333; font-size: 16px;"><strong>Title:</strong> ${transfer.title}</p>` : ""}
              ${transfer.message ? `<p style="margin: 0 0 20px; color: #666666; font-size: 14px; background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">${transfer.message}</p>` : ""}

              <!-- Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
                <tr>
                  <td style="padding: 15px 20px; text-align: center; border-right: 1px solid #e0e0e0;">
                    <div style="color: #667eea; font-size: 24px; font-weight: 600;">${transfer.fileCount}</div>
                    <div style="color: #666666; font-size: 12px; text-transform: uppercase;">Files</div>
                  </td>
                  <td style="padding: 15px 20px; text-align: center;">
                    <div style="color: #667eea; font-size: 24px; font-weight: 600;">${formatBytes(transfer.totalSize)}</div>
                    <div style="color: #666666; font-size: 12px; text-transform: uppercase;">Total Size</div>
                  </td>
                </tr>
              </table>

              <!-- Download Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Download Files
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Warning -->
              <p style="margin: 20px 0 0; color: #999999; font-size: 12px; text-align: center;">
                This link expires on ${transfer.expiresAt.toLocaleDateString()} at ${transfer.expiresAt.toLocaleTimeString()}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                This email was sent by Transfer App
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  for (const email of recipientEmails) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        html,
      });
      console.log(`Email sent to ${email}`);
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
    }
  }
}
