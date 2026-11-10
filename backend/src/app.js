const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const umkmRoutes = require('./routes/umkmRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const productRoutes = require('./routes/productRoutes');
const stockLogRoutes = require('./routes/stockLogRoutes');
const debtRoutes = require('./routes/debtRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.url}`);
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/umkm', umkmRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock-logs', stockLogRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api', voiceRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

module.exports = app;
