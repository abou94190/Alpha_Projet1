const express = require('express');
const router = express.Router();

// Page de connexion simulée
router.get('/login', (req, res) => {
  // En mode démo, on redirige automatiquement vers la page d'accueil
  res.redirect('/files');
});

module.exports = router;
