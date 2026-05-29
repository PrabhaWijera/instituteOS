import nodemailer from 'nodemailer';
import { env } from './env';
import logger from '../utils/logger';

// Configure email transporter
let transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT, 10),
  secure: parseInt(env.SMTP_PORT, 10) === 465, // true for 465, false for 587
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Test connection on startup (optional)
transporter.verify((error, success) => {
  if (error) {
    logger.warn('SMTP connection failed', { error: error.message });
  } else {
    logger.info('SMTP connection verified');
  }
});

export interface AlertEmail {
  subject: string;
  body: string;
  htmlBody: string;
  recipients: string[];
}

export async function sendAlert(alert: AlertEmail): Promise<boolean> {
  try {
    const mailOptions = {
      from: env.EMAIL_FROM,
      to: alert.recipients.join(','),
      subject: `[NexClass Alert] ${alert.subject}`,
      text: alert.body,
      html: alert.htmlBody,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Alert email sent', { subject: alert.subject, recipients: alert.recipients });
    return true;
  } catch (error) {
    logger.error('Failed to send alert email', {
      subject: alert.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// Pre-formatted alert templates
export const AlertTemplates = {
  highErrorRate: (errorRate: number, threshold: number, recipients: string[]) => ({
    subject: `High Error Rate Detected: ${(errorRate * 100).toFixed(2)}%`,
    body: `Error rate has exceeded threshold of ${(threshold * 100).toFixed(2)}%.\nCurrent: ${(errorRate * 100).toFixed(2)}%`,
    htmlBody: `
      <h2>⚠️ High Error Rate Alert</h2>
      <p>Error rate has exceeded the configured threshold.</p>
      <ul>
        <li><strong>Current Error Rate:</strong> ${(errorRate * 100).toFixed(2)}%</li>
        <li><strong>Threshold:</strong> ${(threshold * 100).toFixed(2)}%</li>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p>Please check the Grafana dashboard for more details.</p>
    `,
    recipients,
  }),

  highCpuUsage: (cpuUsage: number, threshold: number, recipients: string[]) => ({
    subject: `High CPU Usage: ${cpuUsage.toFixed(2)}%`,
    body: `CPU usage has exceeded threshold of ${threshold}%.\nCurrent: ${cpuUsage.toFixed(2)}%`,
    htmlBody: `
      <h2>⚠️ High CPU Usage Alert</h2>
      <p>CPU usage has exceeded the configured threshold.</p>
      <ul>
        <li><strong>Current CPU:</strong> ${cpuUsage.toFixed(2)}%</li>
        <li><strong>Threshold:</strong> ${threshold}%</li>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p>Consider scaling up resources if this persists.</p>
    `,
    recipients,
  }),

  highMemoryUsage: (memoryUsage: number, threshold: number, recipients: string[]) => ({
    subject: `High Memory Usage: ${memoryUsage.toFixed(2)}%`,
    body: `Memory usage has exceeded threshold of ${threshold}%.\nCurrent: ${memoryUsage.toFixed(2)}%`,
    htmlBody: `
      <h2>⚠️ High Memory Usage Alert</h2>
      <p>Memory usage has exceeded the configured threshold.</p>
      <ul>
        <li><strong>Current Memory:</strong> ${memoryUsage.toFixed(2)}%</li>
        <li><strong>Threshold:</strong> ${threshold}%</li>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p>Check for memory leaks. Consider restarting the service.</p>
    `,
    recipients,
  }),

  databaseConnectionFailed: (error: string, recipients: string[]) => ({
    subject: 'Database Connection Failed',
    body: `Database connection error: ${error}`,
    htmlBody: `
      <h2>🚨 Database Connection Failed</h2>
      <p>Unable to connect to the database.</p>
      <p><strong>Error:</strong> ${error}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p>Immediate action required!</p>
    `,
    recipients,
  }),

  highResponseTime: (responseTime: number, threshold: number, recipients: string[]) => ({
    subject: `High Response Time: ${responseTime.toFixed(0)}ms`,
    body: `Response time has exceeded threshold of ${threshold}ms.\nCurrent: ${responseTime.toFixed(0)}ms`,
    htmlBody: `
      <h2>⚠️ High Response Time Alert</h2>
      <p>API response time has exceeded the configured threshold.</p>
      <ul>
        <li><strong>Current Response Time:</strong> ${responseTime.toFixed(0)}ms</li>
        <li><strong>Threshold:</strong> ${threshold}ms</li>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p>Check database performance and external API calls.</p>
    `,
    recipients,
  }),

  serviceDown: (service: string, recipients: string[]) => ({
    subject: `Service Down: ${service}`,
    body: `The ${service} service is down or unreachable.`,
    htmlBody: `
      <h2>🚨 Service Down Alert</h2>
      <p>The following service is not responding:</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p>Immediate action required!</p>
    `,
    recipients,
  }),
};

