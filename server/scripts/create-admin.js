import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { User } from "../src/models.js";

if (!process.env.MONGODB_URI)
  throw new Error("Set MONGODB_URI in server/.env first.");
const prompt = createInterface({ input: stdin, output: stdout });
const ask = (question) =>
  new Promise((resolve) => prompt.question(question, resolve));

const askPassword = (question) =>
  new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof prompt._writeToOutput !== "function") {
      reject(
        new Error(
          "Administrator setup must be run in an interactive terminal so the password stays hidden, or provide ADMIN_PASSWORD in the environment.",
        ),
      );
      return;
    }

    const writeToOutput = prompt._writeToOutput;
    prompt._writeToOutput = (text) => {
      if (text === question || text === "\r\n" || text === "\n")
        stdout.write(text);
    };
    prompt.question(question, (answer) => {
      prompt._writeToOutput = writeToOutput;
      resolve(answer);
    });
  });

try {
  const name = (
    process.env.ADMIN_NAME || (await ask("Administrator name: "))
  ).trim();
  const email = (
    process.env.ADMIN_EMAIL || (await ask("Administrator email: "))
  )
    .trim()
    .toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD ||
    (await askPassword("Password (12+ characters; input hidden): "));

  if (!name || !email.includes("@") || password.length < 12)
    throw new Error(
      "Provide a name, valid email, and password with at least 12 characters.",
    );

  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: "admin" });
  console.log(`Administrator account created for ${user.email}.`);
} finally {
  prompt.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
