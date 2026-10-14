import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { closePool } from './db/database';
import productsRouter from './routes/products';
import salesRouter from './routes/sales';
import dashboardRouter from './routes/dashboard';
import seedRouter from './routes/seed';
import ordersRouter from './routes/orders';
import onboardRouter from './routes/onboard';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check (unauthenticated)
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Route registration — all inventory routes require auth (enforced in each router)
app.use('/api/v1/onboard', onboardRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/products/:id', salesRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/seed', seedRouter);
app.use('/api/v1/orders', ordersRouter);

// Start server — migrations must be run separately with: npm run migrate
async function startServer() {
  app.listen(PORT, () => {
    console.log(`Smart Inventory backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
    console.log('NOTE: Run "npm run migrate" to apply schema migrations before first use.');
  });
}

process.on('SIGTERM', async () => { await closePool(); process.exit(0); });
process.on('SIGINT',  async () => { await closePool(); process.exit(0); });

startServer();

export default app;
