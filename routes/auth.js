const express = require('express');
const passport = require('passport');
const router = express.Router();

// Page de connexion
router.get('/login', (req, res) => {
  // Si l'utilisateur est déjà authentifié, redirige vers /files
  if (req.isAuthenticated()) {
    return res.redirect('/files');
  }
  res.render('login'); // Rendre la vue de connexion
});

// Route de soumission du formulaire de connexion
router.post('/login', passport.authenticate('ldapauth', {
  successRedirect: '/files', // Redirige vers /files en cas de succès
  failureRedirect: '/login' // Redirige vers /login en cas d'échec
}));

// Déconnexion de l'utilisateur
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect('/login'); // Redirige vers la page de connexion après déconnexion
  });
});

module.exports = router;
