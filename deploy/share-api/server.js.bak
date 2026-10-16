const express = require('express');
const path = require('path');
const cors = require('cors');              // 👈 1. agrega esta línea
const share = require('./routes/share');
const resolve = require('./routes/resolve');
const app = express();
app.use(cors());                            // 👈 2. agrega esta línea (antes de las rutas)
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
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Share API escuchando en puerto ${port}`);
});
