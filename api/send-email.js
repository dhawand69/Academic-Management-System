// api/send-email.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Notice the new 'isReset' variable being extracted
        const { email, name, rollno, password, isReset } = req.body;

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, 
            auth: {
                user: process.env.GMAIL_USER, 
                pass: process.env.GMAIL_APP_PASSWORD, 
            },
        });

        // 1. Dynamically set the Subject and Message based on whether it's a reset
        const subject = isReset 
            ? 'Security Alert: Your Portal Password Has Been Reset' 
            : 'Your Academic Portal Login Credentials';

        const messageContext = isReset 
            ? `<p>Your password has been securely reset by the Examination Department because it was reported as lost or compromised.</p>
               <p>Please use your new credentials below and <strong>keep them safe for future use.</strong></p>`
            : `<p>Your portal access has been generated. Please use the following credentials to log in:</p>`;

        // 2. Prepare the Message
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Academic Management System</h2>
                    <p>Hey <strong>${name}</strong>,</p>
                    ${messageContext}
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 0;"><strong>Registration No:</strong> ${rollno}</p>
                        <p style="margin: 5px 0 0 0;"><strong>New Password:</strong> <span style="font-family: monospace; font-size: 16px; color: #d35400;">${password}</span></p>
                    </div>
                    <p>Regards,<br>Examination Department</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`🚀 Sent credentials to: ${email}`);

        return res.status(200).json({ success: true, message: 'Email sent successfully' });

    } catch (error) {
        console.error(`❌ Failed to send email:`, error);
        return res.status(500).json({ success: false, error: 'Failed to send email' });
    }
}
