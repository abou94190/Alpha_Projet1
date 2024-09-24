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
router.get('/', async (req, res) => {
    const user = req.user; // Utilisateur authentifié
    try {
        let files;

        // Vérifiez si l'utilisateur est un admin
        if (user.isAdmin) {
            files = await File.find(); // Récupérer tous les fichiers pour les admins
        } else {
            files = await File.find({ uploadedBy: user._id }); // Récupérer uniquement les fichiers de l'utilisateur
        }

        res.render('files', { user, files }); // Rendre la vue avec les fichiers
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


// Route pour uploader un fichier
router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        req.flash('error', 'Erreur lors du chargement du fichier.');
        return res.redirect('/files');
    }

    const newFile = new File({
        filename: req.file.originalname,
        uploadedBy: req.user._id, // Associez le fichier à l'utilisateur
    });

    try {
        await newFile.save(); // Enregistrer le fichier dans la base de données
        req.flash('success', 'Fichier chargé avec succès!');
        res.redirect('/files');
    } catch (err) {
        console.error(err);
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
