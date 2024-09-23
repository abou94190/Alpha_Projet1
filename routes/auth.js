const express = require('express');
const router = express.Router();

// Page de connexion simulée
router.get('/login', (req, res) => {
  res.redirect('/files');
});

// Déconnexion de l'utilisateur
router.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect('/login');
  });
});

module.exports = router;
