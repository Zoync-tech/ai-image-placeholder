require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      port: PORT,
      hasSupabase: !!process.env.SUPABASE_URL,
      hasStripe: !!process.env.STRIPE_SECRET_KEY
    }
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api-keys', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-keys.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/subscription', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscription.html'));
});

app.get('/subscription-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscription-success.html'));
});

// Basic API routes (minimal versions)
app.post('/api/auth/login', (req, res) => {
  res.status(501).json({ error: 'Authentication not implemented in minimal server' });
});

app.post('/api/auth/signup', (req, res) => {
  res.status(501).json({ error: 'Authentication not implemented in minimal server' });
});

app.post('/api/auth/verify-email', (req, res) => {
  res.status(501).json({ error: 'Authentication not implemented in minimal server' });
});

app.post('/api/auth/resend-verification', (req, res) => {
  res.status(501).json({ error: 'Authentication not implemented in minimal server' });
});

app.post('/api/auth/forgot-password', (req, res) => {
  res.status(501).json({ error: 'Authentication not implemented in minimal server' });
});

app.post('/api/auth/reset-password', (req, res) => {
  res.status(501).json({ error: 'Authentication not implemented in minimal server' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
