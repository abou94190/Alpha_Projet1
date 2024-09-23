const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');

const app = express();

// Connexion à MongoDB
mongoose.connect('mongodb://localhost:27017/ton_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connecté à MongoDB');
}).catch(err => {
  console.error('Erreur de connexion à MongoDB', err);
});

// Middleware pour traiter les données du formulaire
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration de la session
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // Utilisation de connect-flash

// Middleware pour passer les messages flash à la vue
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Configuration du moteur de templates EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuration LDAP
const OPTS = {
  server: {
    url: 'ldap://192.168.1.21:389',
    bindDN: 'CN=Administrateur,CN=Users,DC=workshop,DC=local', // Remplace par le bon DN
    bindCredentials: 'Epsi2022!', // Mot de passe
    searchBase: 'DC=workshop,DC=local',
    searchFilter: '(sAMAccountName={{username}})' // Utilise sAMAccountName
  }
};

passport.use(new LdapStrategy(OPTS, (user, done) => {
  if (user) {
    console.log('Utilisateur authentifié :', user);
    return done(null, user);
  } else {
    console.log('Échec de l\'authentification');
    return done(null, false, { message: 'Nom d’utilisateur ou mot de passe incorrect' });
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
      return res.redirect('/files'); // Redirige vers la page des fichiers si l'utilisateur est connecté
  }
  res.redirect('/login'); // Sinon, redirige vers la page de connexion
});

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/file');
app.use('/', authRoutes);
app.use('/files', fileRoutes);

// Serveur statique pour les fichiers CSS et JS
app.use(express.static(path.join(__dirname, 'public')));

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
