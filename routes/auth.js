const express = require('express');
const passport = require('passport');
const router = express.Router();

// Page de connexion
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/files');
  }
  res.render('login', { messages: req.flash('error') });
});

// Route de soumission du formulaire de connexion
router.post('/login', passport.authenticate('ldapauth', {
  successRedirect: '/files',
  failureRedirect: '/login',
  failureFlash: true
}));

// Déconnexion
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect('/login');
  });
});

module.exports = router;
