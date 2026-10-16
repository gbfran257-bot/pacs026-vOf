const express = require('express');
const path = require('path');
const cors = require('cors');
const share = require('./routes/share');
const resolve = require('./routes/resolve');
const portalAuth = require('./routes/portalAuth');   // NUEVO
const studies = require('./routes/studies');         // NUEVO
const app = express();
app.use(cors());
app.use(express.json());
/**
 * Servir frontend (index.html)
 */
app.use(express.static(path.join(__dirname, 'public')));
/**
 * API
 */
app.use('/api/share', share);
app.use('/api/resolve', resolve);
app.use('/api/portal-auth', portalAuth);             // NUEVO
app.use('/api/studies', studies);                    // NUEVO
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Share API escuchando en puerto ${port}`);
});
