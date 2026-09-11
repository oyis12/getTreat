
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => console.log('✅ Connected to GetTreat Secure Database'));
  mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('⚠️ Disconnected from Database. Attempting to reconnect...'));

  const options = {
    autoIndex: !env.isProd,
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    if (!env.isProd && env.isPublicDns === 'true') {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    }

    await mongoose.connect(env.mongoUri, options);
  } catch (err) {
    console.error('❌ Critical: Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

export async function closeDB() {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed safely');
  } catch (err) {
    console.error('❌ Error during MongoDB shutdown:', err.message);
  }
}
