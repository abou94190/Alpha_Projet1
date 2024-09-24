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

// definition du role admin
passport.deserializeUser((user, done) => {
  if (user.cn === 'adminprof') {
    user.role = 'admin'; 	// utiliser 'adminprof' dans l'ad pour que le site l'authentifi avec les droits admin + ajouter dans le futur les vrais nom des personnes qui serons admin comme ce model
  } else {
    user.role = 'user';		//sinon l'utilisateur reste en cathhegorie standard 
  }
  done(null, user);
});

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
