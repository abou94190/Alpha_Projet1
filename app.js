const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const path = require('path');
// const MongoStore = require('connect-mongo'); // Commenté car nous n'utilisons pas MongoDB pour l'instant

// Initialisation de l'application Express
const app = express();

// Configuration de la session
app.use(session({
  secret: 'my-production-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Pas besoin de HTTPS pour l'instant
    maxAge: 1000 * 60 * 60 // 1 heure
  }
  // store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/sessions' }) // Commenté car nous n'utilisons pas MongoDB
}));

app.use(passport.initialize());
app.use(passport.session());

// Configuration du moteur de templates EJS pour rendre les vues
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuration LDAP pour la production
const OPTS = {
  server: {
    url: 'ldap://TON_SERVEUR_LDAP:389', // Adresse de ton serveur LDAP réel
    bindDN: 'cn=admin,dc=tondomaine,dc=com', // DN de connexion administrateur LDAP
    bindCredentials: 'tonmotdepasse', // Mot de passe de l'admin LDAP
    searchBase: 'dc=tondomaine,dc=com', // Base de recherche dans ton LDAP
    searchFilter: '(uid={{username}})' // Filtre de recherche pour les utilisateurs LDAP
  }
};

passport.use(new LdapStrategy(OPTS));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/file');
app.use('/', authRoutes);
app.use('/files', fileRoutes);

// Serveur statique pour les fichiers CSS et JS
app.use(express.static(path.join(__dirname, 'public')));

// Démarrer le serveur HTTP
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

const mongoose = require('mongoose');

// Connexion à la base de données MongoDB
mongoose.connect('mongodb://localhost:27017/file_storage', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erreur de connexion à MongoDB:'));
db.once('open', () => {
  console.log('Connecté à MongoDB');
});
