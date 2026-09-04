const express = require('express');
const cors = require('cors');
const path = require('path');
const shareRoutes = require('./routes/share');
const resolveRoutes = require('./routes/resolve');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api', shareRoutes);
app.use('/api', resolveRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pacs-share-api' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Share API running on port ${PORT}`);
});
