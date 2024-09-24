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
// app.js ou server.js

const dbURI = 'mongodb://127.0.0.1:27017/mon_atelier';

mongoose.connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 20000 // Délai d'attente pour la connexion
})
.then(() => {
    console.log('Connexion à la base de données réussie !');
})
.catch(err => {
    console.error('Erreur de connexion à la base de données:', err);
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
  console.log('Utilisateur LDAP:', user);

  if (user) {
      // Assurez-vous que memberOf est un tableau
      const memberOfArray = Array.isArray(user.memberOf) ? user.memberOf : [user.memberOf];
      const isAdmin = memberOfArray.includes('CN=Admin,DC=workshop,DC=local');

      console.log(`Utilisateur ${user.sAMAccountName} est admin: ${isAdmin}`);
      return done(null, { ...user, isAdmin });
  } else {
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
const connectDB = require('./DB/db');
app.use('/', authRoutes);
app.use('/files', fileRoutes);

app.post('/login', passport.authenticate('ldapauth', {
  failureRedirect: '/login',
  failureFlash: true
}), (req, res) => {
  console.log(`Utilisateur connecté: ${req.user.sAMAccountName}`);
  if (req.user.isAdmin) {
      console.log(`Redirection admin pour l'utilisateur ${req.user.sAMAccountName}`);
      return res.redirect('/files/admin'); // Redirige vers la page admin
  }
  console.log(`Redirection utilisateur pour l'utilisateur ${req.user.sAMAccountName}`);
  res.redirect('/files'); // Redirige vers la page des fichiers pour les autres utilisateurs
});


app.get('/redirect-after-login', (req, res) => {
  // Vérifiez si l'utilisateur est un admin
  if (req.user.isAdmin) {
      return res.redirect('/files/admin'); // Redirige vers la page admin
  }
  res.redirect('/files'); // Redirige vers la page des fichiers pour les autres utilisateurs
});

// Serveur statique pour les fichiers CSS et JS
app.use(express.static(path.join(__dirname, 'public')));

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
