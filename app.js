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
const dbURI = 'mongodb://127.0.0.1:27017/mon_atelier'; // Remplacez par votre URI MongoDB pour le cloud

// Connect to MongoDB
mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 20000 // Délai d'attente de connexion
})
.then(() => {
    console.log('Connexion à la base de données réussie !');
})
.catch(err => {
    console.error('Erreur de connexion à la base de données:', err);
});

// Middleware pour gérer les données de formulaire
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration de session
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // Utiliser connect-flash

// Middleware pour passer les messages flash à la vue
app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

// Configurer le moteur de vue EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuration LDAP
const OPTS = {
    server: {
        url: 'ldap://192.168.1.21:389',
        bindDN: 'CN=Administrateur,CN=Users,DC=workshop,DC=local', // Remplacez par le bon DN
        bindCredentials: 'Epsi2022!', // Mot de passe
        searchBase: 'DC=workshop,DC=local',
        searchFilter: '(sAMAccountName={{username}})' // Utiliser sAMAccountName
    }
};

passport.use(new LdapStrategy(OPTS, (user, done) => {
    console.log('Utilisateur LDAP:', user);

    if (user) {
        // Assurez-vous que memberOf est un tableau
        const memberOfArray = Array.isArray(user.memberOf) ? user.memberOf : (user.memberOf ? [user.memberOf] : []);
        const isAdmin = memberOfArray.includes('CN=Admin,DC=workshop,DC=local');
        const isProf = memberOfArray.includes('CN=Prof,DC=workshop,DC=local'); // Assurez-vous que c'est le bon DN pour les professeurs

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

// Route d'accueil
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/files'); // Rediriger vers la page des fichiers si l'utilisateur est connecté
    }
    res.render('role-selection'); // Rendre la vue de sélection de rôle
});

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/file');
app.use('/', authRoutes);
app.use('/files', fileRoutes);

// Route pour télécharger un fichier
app.get('/files/download/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).send('Fichier non trouvé');
        }

        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.filename}"`,
        });

        res.send(file.buffer); // Supposons que les données binaires sont stockées dans le champ 'buffer'
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// Route de connexion
app.post('/login', passport.authenticate('ldapauth', {
    failureRedirect: '/login',
    failureFlash: true
}), (req, res) => {
    console.log(`Utilisateur connecté: ${req.user.sAMAccountName}`);
    
    if (req.user.isAdmin) {
        console.log(`Redirection admin pour l'utilisateur ${req.user.sAMAccountName}`);
        return res.redirect('/files/admin'); // Rediriger vers la page admin
    } else if (req.user.isProf) {
        console.log(`Redirection prof pour l'utilisateur ${req.user.sAMAccountName}`);
        return res.redirect('/files/resources'); // Rediriger vers la page des ressources pour les profs
    }
    
    console.log(`Redirection utilisateur pour l'utilisateur ${req.user.sAMAccountName}`);
    res.redirect('/files'); // Rediriger vers la page des fichiers pour les autres utilisateurs
});

// Serveur statique pour les fichiers CSS et JS
app.use(express.static(path.join(__dirname, 'public')));

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
