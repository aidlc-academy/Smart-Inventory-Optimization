import express from 'express';
import cors from 'cors';
import db from './db/database';
import { runMigrations } from './db/migrations';
import productsRouter from './routes/products';
import salesRouter from './routes/sales';
import dashboardRouter from './routes/dashboard';
import seedRouter from './routes/seed';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Run database migrations on startup
runMigrations(db);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Route registration
app.use('/api/v1/products', productsRouter);

// Sales, restock, and movements routes are all on salesRouter mounted at the product level
// Routes: GET/POST /sales, POST /restock, GET /movements
app.use('/api/v1/products/:id', salesRouter);

app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/seed', seedRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Smart Inventory backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
});

export default app;
