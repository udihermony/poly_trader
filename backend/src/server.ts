import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import './config/database'; // Import to trigger initialization
import { errorHandler, notFound } from './middleware/error.middleware';

// Import routes
import configRoutes from './routes/config.routes';
import marketsRoutes from './routes/markets.routes';
import tradesRoutes from './routes/trades.routes';
import tradingRoutes from './routes/trading.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import snipeRoutes from './routes/snipe.routes';
import spreadRoutes from './routes/spread.routes';
import accountRoutes from './routes/account.routes';
import tradeRoutes from './routes/trade.routes';

// Import services
import { tradingService } from './services/trading.service';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database is initialized automatically when database module is imported

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PolyTrader API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/config', configRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/snipe', snipeRoutes);
app.use('/api/spread', spreadRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/trade', tradeRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Export io for use in services
export { io };

// Start server
const PORT = process.env.PORT || 8000;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Initialize trading service
  try {
    await tradingService.initialize();
    console.log('Trading service initialized successfully');

    // Auto-start if trading is enabled
    const { queries } = await import('./config/database');
    const appConfig: any = queries.getAppConfig.get();
    if (appConfig?.trading_enabled) {
      await tradingService.start();
      console.log('Trading service auto-started (trading enabled)');
    } else {
      console.log('Trading service initialized but not started (trading disabled)');
    }
  } catch (error) {
    console.error('Failed to initialize trading service:', error);
  }

  // Auto-start spread resolution checker if there are open spread trades
  try {
    const { spreadService } = await import('./services/spread.service');
    spreadService.startResolver();
  } catch (error) {
    console.error('Failed to start spread resolver:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
