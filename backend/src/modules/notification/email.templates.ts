import { env } from '../../config/env';

const baseUrl = env.FRONTEND_URL;
const appName = env.APP_NAME;

export const emailTemplates = {
  instituteCreated: (data: { adminName: string; instituteName: string; inviteLink: string }) => ({
    subject: `Welcome to ${appName} — ${data.instituteName}`,
    html: `
      <h2>Welcome to ${appName}, ${data.adminName}!</h2>
      <p>Your institute <strong>${data.instituteName}</strong> has been created on the ${appName} platform.</p>
      <p>Click the link below to set your password and access your admin dashboard:</p>
      <a href="${baseUrl}/invite?token=${data.inviteLink}" style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:6px;">Set Password & Login</a>
      <p>This link expires in 48 hours.</p>
      <p>— The ${appName} Team</p>
    `,
  }),

  teacherInvited: (data: { teacherName: string; instituteName: string; inviteLink: string }) => ({
    subject: `You've been invited to teach at ${data.instituteName}`,
    html: `
      <h2>Hello ${data.teacherName}!</h2>
      <p>You have been invited to join <strong>${data.instituteName}</strong> as a Teacher on ${appName}.</p>
      <p>Click below to set your password and get started:</p>
      <a href="${baseUrl}/invite?token=${data.inviteLink}" style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:6px;">Accept Invite</a>
      <p>This link expires in 48 hours.</p>
      <p>— The ${appName} Team</p>
    `,
  }),

  studentRegistered: (data: { studentName: string; instituteName: string; inviteLink: string }) => ({
    subject: `Welcome to ${data.instituteName} — Complete Your Profile`,
    html: `
      <h2>Welcome ${data.studentName}!</h2>
      <p>You have been registered at <strong>${data.instituteName}</strong> on ${appName}.</p>
      <p>Click below to set your password and complete your student profile:</p>
      <a href="${baseUrl}/invite?token=${data.inviteLink}" style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:6px;">Get Started</a>
      <p>After setting your password, you'll need to complete your profile for admin verification.</p>
      <p>— The ${appName} Team</p>
    `,
  }),

  parentInvited: (data: { parentName: string; childName: string; instituteName: string; inviteLink: string }) => ({
    subject: `Monitor ${data.childName}'s progress at ${data.instituteName}`,
    html: `
      <h2>Hello ${data.parentName}!</h2>
      <p>You've been invited to the ${appName} parent portal for <strong>${data.childName}</strong> at <strong>${data.instituteName}</strong>.</p>
      <p>As a parent, you can view:</p>
      <ul>
        <li>Attendance records</li>
        <li>Fee payment status</li>
        <li>Enrolled classes & materials</li>
        <li>Real-time notifications</li>
      </ul>
      <a href="${baseUrl}/invite?token=${data.inviteLink}" style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:6px;">Set Password & Login</a>
      <p>— The ${appName} Team</p>
    `,
  }),

  studentEnrolled: (data: { studentName: string; className: string; subject: string; teacherName: string; schedule: string; fee: number; firstDueDate: string }) => ({
    subject: `Enrolled in ${data.className}`,
    html: `
      <h2>Hi ${data.studentName}!</h2>
      <p>You have been enrolled in:</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px;font-weight:bold;">Class:</td><td style="padding:4px 12px;">${data.className}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Subject:</td><td style="padding:4px 12px;">${data.subject}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Teacher:</td><td style="padding:4px 12px;">${data.teacherName}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Schedule:</td><td style="padding:4px 12px;">${data.schedule}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Monthly Fee:</td><td style="padding:4px 12px;">LKR ${data.fee}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">First Due:</td><td style="padding:4px 12px;">${data.firstDueDate}</td></tr>
      </table>
      <p>— The ${appName} Team</p>
    `,
  }),

  paymentDue: (data: { studentName: string; className: string; amount: number; dueDate: string }) => ({
    subject: `Fee Due — ${data.className}`,
    html: `
      <h2>Hi ${data.studentName},</h2>
      <p>Your monthly fee for <strong>${data.className}</strong> is now due.</p>
      <p><strong>Amount:</strong> LKR ${data.amount}<br/>
      <strong>Due Date:</strong> ${data.dueDate}</p>
      <p>⚠️ Your attendance will be blocked after the grace period if payment is not made.</p>
      <p>Please contact your institute admin to make a payment.</p>
      <p>— The ${appName} Team</p>
    `,
  }),

  passwordReset: (data: { userName: string; resetLink: string }) => ({
    subject: `Reset Your ${appName} Password`,
    html: `
      <h2>Hi ${data.userName},</h2>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <a href="${baseUrl}/reset-password?token=${data.resetLink}" style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>— The ${appName} Team</p>
    `,
  }),

  paymentReceived: (data: { studentName: string; className: string; amount: number; method: string; nextBillingDate: string }) => ({
    subject: `Payment Receipt — ${data.className}`,
    html: `
      <h2>Payment Confirmed!</h2>
      <p>Hi ${data.studentName}, your payment has been recorded:</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px;font-weight:bold;">Class:</td><td style="padding:4px 12px;">${data.className}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Amount:</td><td style="padding:4px 12px;">LKR ${data.amount}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Method:</td><td style="padding:4px 12px;">${data.method}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Next Billing:</td><td style="padding:4px 12px;">${data.nextBillingDate}</td></tr>
      </table>
      <p>Your attendance access has been restored. ✓</p>
      <p>— The ${appName} Team</p>
    `,
  }),
};
