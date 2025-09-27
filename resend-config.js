const { Resend } = require('resend');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

class ResendService {
  // Send email verification code
  static async sendVerificationEmail(email, code) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'VRC Cloud Instance Manager <noreply@zoync.com>',
        to: [email],
        subject: 'Verify your email - VRC Cloud Instance Manager',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
              .code { background: #1e293b; color: #0ea5e9; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; font-family: monospace; }
              .button { display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>VRC Cloud Instance Manager</h1>
                <p>Verify your email address</p>
              </div>
              <div class="content">
                <h2>Welcome to VRC Cloud Instance Manager!</h2>
                <p>Thank you for signing up. To complete your registration, please verify your email address using the code below:</p>
                
                <div class="code">${code}</div>
                
                <p>This code will expire in 10 minutes for security reasons.</p>
                
                <p>If you didn't create an account with us, please ignore this email.</p>
                
                <div class="footer">
                  <p>Best regards,<br>The VRC Cloud Instance Manager Team</p>
                  <p>This is an automated message, please do not reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        console.error('Resend email error:', error);
        throw new Error('Failed to send verification email');
      }

      console.log('Verification email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Resend service error:', error);
      throw error;
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email, resetUrl) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'VRC Cloud Instance Manager <noreply@zoync.com>',
        to: [email],
        subject: 'Reset your password - VRC Cloud Instance Manager',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>VRC Cloud Instance Manager</h1>
                <p>Reset your password</p>
              </div>
              <div class="content">
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password for your VRC Cloud Instance Manager account.</p>
                
                <p>Click the button below to reset your password:</p>
                
                <a href="${resetUrl}" class="button">Reset Password</a>
                
                <p>This link will expire in 1 hour for security reasons.</p>
                
                <p>If you didn't request a password reset, please ignore this email.</p>
                
                <div class="footer">
                  <p>Best regards,<br>The VRC Cloud Instance Manager Team</p>
                  <p>This is an automated message, please do not reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        console.error('Resend password reset email error:', error);
        throw new Error('Failed to send password reset email');
      }

      console.log('Password reset email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Resend service error:', error);
      throw error;
    }
  }
}

module.exports = ResendService;
