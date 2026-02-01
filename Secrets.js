import dotenv from "dotenv";
dotenv.config();

export const secrets = {
  port: process.env.PORT,
  sender: process.env.SENDER,
  password_sender: process.env.PASS,
};
