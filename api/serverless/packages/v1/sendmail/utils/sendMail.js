import { createTransport } from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_PASS, SMTP_EMAIL } = process.env;

import { senderEmail, recieverEmail, emailSubject } from "../config/config.js";

const logToConsole = (message) => {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  console.log(logMessage);
};

const sendMail = async (name, from, message) => {
  logToConsole("Sending email...");
  try {
    let transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `${name} <${senderEmail}>`,
      sender: from,
      to: recieverEmail,
      replyTo: from,
      subject: emailSubject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    logToConsole("Email sent!");
    return true;
  } catch (error) {
    logToConsole(`Error sending email: ${error}`);
    throw new Error(error);
  }
};

export default sendMail;
