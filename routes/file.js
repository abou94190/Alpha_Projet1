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
// Route pour afficher la page des fichiers
// Route pour afficher la page des fichiers
router.get('/', async (req, res) => {
    const user = req.user; // Utilisateur authentifié
    try {
        // Extraire l'OU de l'utilisateur
        const ouMatch = user.distinguishedName.match(/OU=([^,]+)/);
        const userOU = ouMatch ? ouMatch[1] : null;

        let files;
        if (user.isAdmin) {
            files = await File.find(); // Les administrateurs peuvent voir tous les fichiers
        } else {
            // Récupérer les fichiers uploadés par l'utilisateur ou partagés avec leur OU
            files = await File.find({
                $or: [
                    { uploadedBy: user.sAMAccountName }, // Fichiers uploadés par l'utilisateur
                    { uploadedByOU: userOU } // Fichiers partagés avec l'OU de l'utilisateur
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

router.get('/files', async (req, res) => {
    try {
        const user = req.user;

        // Assurez-vous que l'utilisateur est authentifié
        if (!user) {
            return res.status(403).send('Accès refusé');
        }

        // Extraire l'OU de l'utilisateur
        const ouMatch = user.distinguishedName.match(/OU=([^,]+)/);
        const userOU = ouMatch ? ouMatch[1] : null;

        console.log('Utilisateur :', user.sAMAccountName);
        console.log('OU :', userOU);

        if (!userOU) {
            return res.status(400).send('Vous devez appartenir à une OU pour voir les fichiers.');
        }

        // Récupérer les fichiers
        const files = await File.find({
            $or: [
                { uploadedBy: user.sAMAccountName },
                { uploadedByOU: userOU }
            ]
        });

        console.log('Fichiers récupérés :', files);
        res.render('files', { files, user });
    } catch (error) {
        console.error('Erreur lors de la récupération des fichiers :', error);
        res.status(500).send('Erreur lors de la récupération des fichiers');
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
    try {
        const user = req.user; // L'utilisateur doit être authentifié

        if (!user) {
            return res.status(403).send('Accès refusé');
        }

        // Extraire l'OU à partir du distinguishedName
        const ouMatch = user.distinguishedName.match(/OU=([^,]+)/); // Cela va chercher la première OU
        const userOU = ouMatch ? ouMatch[1] : null;

        if (!userOU) {
            return res.status(400).send('Vous devez appartenir à une OU pour uploader un fichier.');
        }

        // Création d'un nouvel objet File
        const newFile = new File({
            filename: req.file.originalname, // Nom du fichier
            buffer: req.file.buffer, // Contenu du fichier
            uploadedBy: user.sAMAccountName, // Nom de l'utilisateur qui upload le fichier
            uploadedByOU: userOU, // OU de l'utilisateur
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
