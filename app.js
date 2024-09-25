const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

const DEMO_MODE = process.env.DEMO_MODE || true;  // Mettre à true pour activer le mode démo

// Configuration de la session
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Configuration du moteur de templates EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir les fichiers uploadés

if (!DEMO_MODE) {
  // Configuration LDAP
  const OPTS = {
    server: {
      url: 'ldap://mon-serveur-ldap:389',
      bindDN: 'cn=admin,dc=example,dc=com',
      bindCredentials: 'mon_mot_de_passe_securise',
      searchBase: 'ou=users,dc=example,dc=com',
      searchFilter: '(uid={{username}})'
    }
  };

  passport.use(new LdapStrategy(OPTS));

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });
} else {
  // Mode démo: simuler un utilisateur connecté
  passport.serializeUser((user, done) => {
    done(null, { cn: 'Demo User', uid: 'demo' });
  });

  passport.deserializeUser((user, done) => {
    done(null, { cn: 'Demo User', uid: 'demo' });
  });

  app.use((req, res, next) => {
    req.isAuthenticated = () => true;
    req.user = { cn: 'Demo User', uid: 'demo' };
    next();
  });
}

// Routes d'authentification
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Routes pour la gestion des fichiers
const fileRoutes = require('./routes/file');
app.use('/files', fileRoutes);

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

module.exports = app;