import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { testConnection, closePool } from './config/db';
import { ApiError, ApiResponse } from './types';
import authRoutes           from './routes/authRoutes';
import productsRoutes       from './routes/products.routes';
import customersRoutes      from './routes/customers.routes';
import salesRoutes          from './routes/sales.routes';
import deliveriesRoutes     from './routes/deliveries.routes';
import reportsRoutes        from './routes/reports.routes';
import categoriesRoutes     from './routes/categories.routes';
import usersRoutes          from './routes/users.routes';
import incomeExpensesRoutes from './routes/income-expenses.routes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

/**
 * Middleware Configuration
 */

// CORS Configuration — allow common Next.js dev ports
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files as static assets
// e.g.  GET http://localhost:3001/uploads/products/img-xxx.jpg
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request Logging Middleware (Development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
  });
}

/**
 * API Routes
 */
app.use('/api/auth',             authRoutes);
app.use('/api/products',         productsRoutes);
app.use('/api/customers',        customersRoutes);
app.use('/api/sales',            salesRoutes);
app.use('/api/deliveries',       deliveriesRoutes);
app.use('/api/reports',          reportsRoutes);
app.use('/api/categories',       categoriesRoutes);
app.use('/api/users',            usersRoutes);
app.use('/api/income-expenses',  incomeExpensesRoutes);

/**
 * Health Check Endpoint
 * ໃຊ້ເຊັກສະຖານະຂອງ API ແລະການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ
 */
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbConnected = await testConnection();
    
    const healthStatus: ApiResponse = {
      success: true,
      message: 'IT Shop POS API ກຳລັງເຮັດວຽກ',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: dbConnected ? 'ເຊື່ອມຕໍ່ແລ້ວ' : 'ເຊື່ອມຕໍ່ບໍ່ໄດ້',
        uptime: process.uptime(),
        version: '1.0.0'
      }
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'ບໍລິການບໍ່ພ້ອມໃຊ້ງານ',
      error: error instanceof Error ? error.message : 'ຂໍ້ຜິດພາດທີ່ບໍ່ຮູ້ຈັກ'
    });
  }
});

/**
 * Root Endpoint
 */
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ຍິນດີຕ້ອນຮັບສູ່ IT Shop POS API',
    data: {
      version: '1.0.0',
      documentation: '/api/docs',
      health: '/api/health'
    }
  });
});

/**
 * 404 Not Found Handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'ບໍ່ພົບ Endpoint',
    error: `Cannot ${req.method} ${req.path}`
  });
});

/**
 * Global Error Handler
 */
app.use((err: ApiError | Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error:', err);

  if ('status' in err && typeof err.status === 'number') {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      error: err.details || undefined
    });
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'ເກີດຂໍ້ຜິດພາດພາຍໃນ',
    error: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.stack : undefined) : undefined
  });
});

/**
 * Start Server
 */
async function startServer() {
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database.');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 IT Shop POS API Server is running`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received: closing server');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received: closing server');
  await closePool();
  process.exit(0);
});

startServer();

export default app;
