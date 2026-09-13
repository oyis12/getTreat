import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { connectDB, closeDB } from './config/db.js';

import passport from "passport";
import { configurePassport } from "./config/passport.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

import authRoutes from "./routes/auth.routes.js";
import patientProfileRoutes from "./routes/patient-profile.routes.js";



process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...', err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...', err);
  if (typeof gracefulShutdown === 'function') {
    gracefulShutdown('unhandledRejection');
  } else {
    process.exit(1);
  }
});



const app = express();

app.use(cors({
  origin: env.corsOrigins.length > 0 ? env.corsOrigins : '*',
  credentials: true,
}));

app.use(helmet());

configurePassport();

app.use(passport.initialize());


app.use(express.json({ limit: '10kb' }));

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientProfileRoutes);


app.use(errorMiddleware);

let server;

(async () => {
  try {
    await connectDB();
    server = app.listen(env.port, () => {
      console.log(`✅ Smarthub System running on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (err) {
    console.error('❌ Bootstrap Failed:', err.message);
    process.exit(1);
  }
})();

async function gracefulShutdown(signal) {
  console.log(`\n🛑 Signal: ${signal}. Cleaning up...`);
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('✅ HTTP server closed');
    }
    await closeDB();
    console.log('✅ Database connection closed');
    process.exit(signal === 'uncaughtException' ? 1 : 0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));