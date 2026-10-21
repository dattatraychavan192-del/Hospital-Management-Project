import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const app = createApp();
try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_management');
  app.locals.databaseReady = true;
  app.listen(port, () => console.log(`Hospital API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Unable to start the API:', error.message);
  process.exitCode = 1;
}
