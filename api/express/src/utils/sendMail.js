import nodemailer from "nodemailer";
import { appendFile } from "fs";
const { SMTP_HOST, SMTP_PORT, SMTP_PASS, SMTP_EMAIL } = import.meta.env;

import { senderEmail, recieverEmail, emailSubject } from "../config/config";

const logToFile = (message) => {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  appendFile("sendMail.log", logMessage, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
    }
  });
};

const sendMail = async (name, from, message) => {
  logToFile("Sending email..., in the sendMail.js file");
  try {
    let transporter = nodemailer.createTransport({
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
    logToFile("Email sent!");
    return true;
  } catch (error) {
    logToFile(`Error sending email: ${error}`);
    return false;
  }
};

export default sendMail;
