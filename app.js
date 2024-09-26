const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');

const app = express();
const File = require('./models/File'); // Assurez-vous que le chemin est correct
const dbURI = 'mongodb://127.0.0.1:27017/mon_atelier';

// Connect to MongoDB
mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 20000 // Connection timeout
})
.then(() => {
    console.log('Connexion à la base de données réussie !');
})
.catch(err => {
    console.error('Erreur de connexion à la base de données:', err);
});

// Middleware to handle form data
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // Use connect-flash

// Middleware to pass flash messages to the view
app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

// Configure EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use('/public', express.static(path.join(__dirname, 'public'))); // Added line for serving static files

app.use('/views', express.static(path.join(__dirname, 'views')));

// LDAP Configuration
const OPTS = {
    server: {
        url: 'ldap://192.168.1.21:389',
        bindDN: 'CN=Administrateur,CN=Users,DC=workshop,DC=local', // Remplacez par le bon DN
        bindCredentials: 'Epsi2022!', // Mot de passe
        searchBase: 'DC=workshop,DC=local',
        searchFilter: '(sAMAccountName={{username}})' // Utilisez sAMAccountName
    }
};

passport.use(new LdapStrategy(OPTS, (user, done) => {
    console.log('Utilisateur LDAP:', user);

    if (user) {
        const memberOfArray = Array.isArray(user.memberOf) ? user.memberOf : (user.memberOf ? [user.memberOf] : []);
        const isAdmin = memberOfArray.includes('CN=Admin,DC=workshop,DC=local');
        const isProf = memberOfArray.includes('CN=Prof,DC=workshop,DC=local');

        console.log(`Utilisateur ${user.sAMAccountName} est admin: ${isAdmin}`);
        console.log(`Utilisateur ${user.sAMAccountName} est prof: ${isProf}`);

        return done(null, { 
            ...user, 
            isAdmin, 
            isProf,
            memberOf: memberOfArray 
        });
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
    res.redirect('/choix'); // Redirige vers la page de choix si non connecté
});

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/file');
app.use('/', authRoutes);
app.use('/files', fileRoutes);

// Route to download a file
app.get('/files/download/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).send('File not found');
        }

        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.filename}"`,
        });

        res.send(file.buffer); // Supposons que les données binaires sont stockées dans le champ 'buffer'
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Login route
app.post('/login', passport.authenticate('ldapauth', {
    failureRedirect: '/login',
    failureFlash: true
}), (req, res) => {
    console.log(`Utilisateur connecté: ${req.user.sAMAccountName}`);
    
    if (req.user.isAdmin) {
        console.log(`Redirection admin pour l'utilisateur ${req.user.sAMAccountName}`);
        return res.redirect('/files/admin'); // Redirige vers la page admin
    } else if (req.user.isProf) {
        console.log(`Redirection prof pour l'utilisateur ${req.user.sAMAccountName}`);
        return res.redirect('/files/resources'); // Redirige vers la page des ressources pour les profs
    }
    
    console.log(`Redirection utilisateur pour l'utilisateur ${req.user.sAMAccountName}`);
    res.redirect('/files'); // Redirige vers la page des fichiers pour les autres utilisateurs
});

// Static server for CSS and JS files
// This line is now redundant due to the earlier static serving line.
// app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
