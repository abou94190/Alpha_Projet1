// routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File'); // Importer le modèle
const isAuthenticated = require('../middleware/authMiddleware');

// Utiliser le middleware d'authentification
router.use(isAuthenticated);

// Configuration de Multer
const storage = multer.memoryStorage(); // Stockage en mémoire
const upload = multer({ storage });

/// Route pour afficher la page des fichiers
router.get('/', async (req, res) => {
    const user = req.user; // Utilisateur authentifié
    if (user.isProf) {
        // Redirige les professeurs vers la page des ressources
        return res.redirect('/files/resources');
    }
    
    try {
        // Assurez-vous que memberOf est un tableau
        const userGroups = Array.isArray(user.memberOf) ? user.memberOf.map(g => g.split('=')[1]) : [];
        let files;
        if (user.isAdmin) {
            files = await File.find(); // Les administrateurs peuvent voir tous les fichiers
        } else {
            // Récupérer les fichiers uploadés par l'utilisateur ou partagés avec leurs groupes
            files = await File.find({
                $or: [
                    { uploadedBy: user.sAMAccountName }, // Fichiers uploadés par l'utilisateur
                    { uploadedByGroup: { $in: userGroups } } // Fichiers partagés avec les groupes de l'utilisateur
                ]
            });
        }

        res.render('files', { user, files }); // Rendre la vue avec les fichiers
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des fichiers.');
        res.redirect('/files');
    }
});

/// Route pour afficher les ressources
router.get('/resources', async (req, res) => {
    const user = req.user;
    try {
        const selectedOU = req.query.ou || ''; // Récupérer l'OU sélectionnée
        let resources;
        if (user.isProf === false) {
            return res.status(403).send('Accès refusé');
        }
        // Récupérer les ressources en fonction de l'OU sélectionnée
        if (selectedOU) {
            resources = await File.find({ uploadedByOU: selectedOU }); // Filtrer les ressources par OU
        } else {
            resources = await File.find(); // Si aucune OU n'est sélectionnée, afficher toutes les ressources
        }

        res.render('resources', { user: req.user, resources, selectedOU }); // Passer l'OU sélectionnée à la vue
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des ressources.');
        res.redirect('/files'); // Rediriger en cas d'erreur
    }
});

// routes/files.js
// Route pour uploader un fichier
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const user = req.user; // L'utilisateur doit être authentifié

        if (!user) {
            return res.status(403).send('Accès refusé');
        }

        // Extraction de l'OU du DN de l'utilisateur
        const ouMatch = user.dn.match(/OU=([^,]+)/); // Capture l'OU du DN
        const uploadedByOU = ouMatch ? ouMatch[1] : 'Inconnu'; // Récupère le nom de l'OU

        // Création d'un nouvel objet File
        const newFile = new File({
            filename: req.file.originalname, // Nom du fichier
            buffer: req.file.buffer, // Contenu du fichier
            uploadedBy: user.sAMAccountName, // Nom de l'utilisateur qui upload le fichier
            uploadedByGroup: user.memberOf, // Liste des groupes de l'utilisateur
            uploadedByOU: uploadedByOU // OU extraite
        });

        // Sauvegarde du fichier
        await newFile.save();

        console.log('Fichier uploadé avec succès :', newFile);
        res.redirect('/files'); // Redirigez vers la page des fichiers
    } catch (error) {
        console.error('Erreur lors de l\'upload du fichier :', error);
        res.status(500).send('Erreur lors de l\'upload du fichier');
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
