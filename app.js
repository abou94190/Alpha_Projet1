const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const isProf = require('./middlewares/isProfMiddleware'); // Import du middleware pour les profs

const app = express();

// Connexion à MongoDB
const File = require('./models/File'); // Ensure the correct path
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
        // Assurez-vous que memberOf est un tableau et qu'il contient des valeurs valides
        const memberOfArray = Array.isArray(user.memberOf) ? user.memberOf : (user.memberOf ? [user.memberOf] : []);
        const isAdmin = memberOfArray.includes('CN=Admin,DC=workshop,DC=local');
        const isProf = memberOfArray.includes('CN=Prof,DC=workshop,DC=local'); // Vérifiez si l'utilisateur est professeur

        console.log(`Utilisateur ${user.sAMAccountName} est admin: ${isAdmin}`);
        
        // Incluez un identifiant utilisateur valide
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
    res.redirect('/login'); // Sinon, redirige vers la page de connexion
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
        // Find the file in the database by ID
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).send('Fichier non trouvé');
        }

        // Set the response headers to prompt a file download
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.filename}"`,
        });

        // Send the file buffer as response
        res.send(file.buffer); // Assuming the binary data is stored in the 'buffer' field
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// Authentification
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

// Route pour les ressources, accessible uniquement par les professeurs
app.get('/files/resources', async (req, res) => {
    if (req.user.isProf) {
        // Filtrer les ressources par groupe
        const userGroup = req.user.memberOf.find(group => group.includes('Prof'));
        const resources = await File.find({ group: userGroup }); // Assurez-vous que la ressource a un champ 'group'
        res.render('resources', { resources });
    } else {
        res.redirect('/'); // Redirection si l'utilisateur n'est pas professeur
    }
});

// Serveur statique pour les fichiers CSS et JS
app.use(express.static(path.join(__dirname, 'public')));

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
