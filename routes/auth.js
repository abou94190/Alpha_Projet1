const express = require('express');
const passport = require('passport');
const path = require('path');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware'); // Importer le middleware

// Page de choix de rôle
router.get('/choix', (req, res) => {
    res.render('choix'); // Rendre la page choix.ejs
});

// Page de connexion
router.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/files');
    }
    res.render('login', { messages: req.flash('error') });
});

// Route de soumission du formulaire de connexion
router.post('/login', passport.authenticate('ldapauth', {
    failureRedirect: '/login',
    failureFlash: true
}), (req, res) => {
    // Redirection en fonction du rôle après connexion
    if (req.user.isAdmin) {
        return res.redirect('/files/admin'); // Redirige vers la page admin
    } else if (req.user.isProf) {
        return res.redirect('/files/resources'); // Redirige vers la page des ressources pour les profs
    } else {
        return res.redirect('/files'); // Redirige vers la page des fichiers pour les autres utilisateurs
    }
});

// Déconnexion
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/choix'); // Rediriger vers la page de choix après déconnexion
    });
});

// Routes pour choisir un rôle
router.get('/login-apprenant', (req, res) => {
    res.redirect('/login'); // Redirige vers la page de connexion pour Apprenant
});

router.get('/login-intervenant', (req, res) => {
    res.redirect('/login'); // Redirige vers la page de connexion pour Intervenant
});

router.get('/login-administrateur', (req, res) => {
    res.redirect('/login'); // Redirige vers la page de connexion pour Administrateur
});

// Middleware d'authentification
router.use(isAuthenticated);

module.exports = router;
