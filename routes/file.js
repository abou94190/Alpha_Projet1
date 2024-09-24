// routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File'); // Importer le modèle
const isAuthenticated = require('../middleware/authMiddleware');

// Utiliser le middleware d'authentification
router.use(isAuthenticated);

// Configuration de Multer (pas besoin de stocker sur le disque, donc inactif ici)
const storage = multer.memoryStorage(); // Stockage en mémoire
const upload = multer({ storage });

// Route pour afficher la page des fichiers
// Route pour afficher la page des fichiers
// Route pour afficher la page des fichiers
router.get('/', async (req, res) => {
    const user = req.user; // Utilisateur authentifié
    try {
        let files;
        if (user.isAdmin) {
            files = await File.find(); // Admins can see all files
        } else {
            // Retrieve files only uploaded by the user or shared with their group
            files = await File.find({
                $or: [
                    { uploadedBy: user._id }, // Files uploaded by the user
                    { uploadedByGroup: user.memberOf ? user.memberOf[0] : '' } // Adjust based on your group logic
                ]
            });
        }
        res.render('files', { user, files }); // Render the view with the files
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des fichiers.');
        res.redirect('/files');
    }
});

// Route pour afficher la page des fichiers pour les admins
router.get('/admin', isAuthenticated, async (req, res) => {
    const user = req.user; // Utilisateur authentifié
    try {
        const files = await File.find(); // Récupérer tous les fichiers
        res.render('admin_files', { user, files }); // Rendre la vue admin
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des fichiers.');
        res.redirect('/files');
    }
});

// Route to display resources
router.get('/resources', async (req, res) => {
    try {
        // Logic to retrieve resources, for example from the database
        const resources = await File.find(); // Modify this to get the actual resources you want to show

        // Render a view for resources
        res.render('resources', { user: req.user, resources });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des ressources.');
        res.redirect('/files'); // Redirect if there's an error
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    console.log("User Object:", req.user);

    if (!req.file) {
        req.flash('error', 'Erreur lors du chargement du fichier.');
        return res.redirect('/files');
    }

    if (!req.user || !req.user.sAMAccountName) {
        console.error("User is not authenticated or user ID is missing");
        req.flash('error', 'Erreur d\'authentification. Veuillez vous reconnecter.');
        return res.redirect('/login');
    }

    // Créez un nouvel objet File
    const newFile = new File({
        filename: req.file.originalname,
        uploadedBy: req.user.sAMAccountName, // Utilisez sAMAccountName comme identifiant
        uploadedByGroup: (req.user.memberOf && req.user.memberOf.length > 0) ? req.user.memberOf[0] : 'DefaultGroup', // Gérer le groupe
        buffer: req.file.buffer, // Assurez-vous que vous passez le buffer ici
    });

    try {
        await newFile.save();
        req.flash('success', 'Fichier chargé avec succès!');
        res.redirect('/files');
    } catch (err) {
        console.error("Error saving file:", err);
        req.flash('error', 'Erreur lors de l\'enregistrement du fichier.');
        res.redirect('/files');
    }
});

// Route pour supprimer un fichier
router.post('/delete/:id', async (req, res) => {
    try {
        await File.findByIdAndDelete(req.params.id); // Supprimer le fichier par ID
        req.flash('success', 'Fichier supprimé avec succès!');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la suppression du fichier.');
    }
    res.redirect('/files');
});


module.exports = router;
