import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/securechat';

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.warn('MongoDB unavailable; continuing without DB connectivity for local Phase 1 setup.', error.message);
    return false;
  }
}
