import sendMail from "./utils/sendMail.js";

export const main = async (event) => {
  const { firstName, lastName, email: from, message } = event;

  try {
    await sendMail(`${firstName} ${lastName}`, from, message);
    return { statusCode: 200, body: { message: "Email sent successfully" } };
  } catch (error) {
    return { statusCode: 500, body: { message: "Error sending email" } };
  }
};
