const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const File = require('../models/File'); // Importer le modèle
const isAuthenticated = require('../middleware/authMiddleware');
const scanFileWithVirusTotal = require('../utils/virusTotal'); // Importer la fonction VirusTotal

// Utiliser le middleware d'authentification
router.use(isAuthenticated);

// Configuration de Multer (utilisation du stockage en mémoire pour traitement avant de sauvegarder)
const storage = multer.memoryStorage(); // Stockage en mémoire
const upload = multer({ storage });

// Route pour afficher la page des fichiers
router.get('/', async (req, res) => {
    const user = req.user; // Utilisateur authentifié
    try {
        const files = await File.find(); // Récupérer tous les fichiers
        res.render('files', { user, files }); // Rendre la vue avec les fichiers
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

    // Sauvegarder temporairement le fichier en local pour l'analyser
    const filePath = path.join(__dirname, '../uploads', req.file.originalname);
    fs.writeFileSync(filePath, req.file.buffer); // Enregistrer le fichier temporairement

    try {
        // Appel à l'API VirusTotal pour analyser le fichier
        const result = await scanFileWithVirusTotal(filePath);

        // Vérification du rapport (par exemple, en fonction du response_code de VirusTotal)
        if (result.response_code !== 1 || result.positives > 0) {
            // VirusTotal a détecté un fichier malveillant, on supprime le fichier temporaire
            fs.unlinkSync(filePath);
            req.flash('error', 'Le fichier téléchargé ne respecte pas les normes de sécurité et a été supprimé.');
            return res.redirect('/files');
        }

        // Si tout va bien, enregistrer le fichier dans MongoDB
        const newFile = new File({
            filename: req.file.originalname,
            filepath: `/uploads/${req.file.originalname}`, // Enregistrer le chemin du fichier
            userId: req.user._id
        });

        await newFile.save(); // Sauvegarder les métadonnées dans la base de données
        req.flash('success', 'Fichier chargé et vérifié avec succès!');
        res.redirect('/files');

    } catch (err) {
        console.error(err);
        fs.unlinkSync(filePath); // Supprimer le fichier en cas d'erreur
        req.flash('error', 'Erreur lors de l\'analyse du fichier.');
        res.redirect('/files');
    }
});

// Route pour supprimer un fichier
router.post('/delete/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (file) {
            // Supprimer le fichier du système de fichiers
            const filePath = path.join(__dirname, '..', file.filepath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            // Supprimer le fichier de la base de données
            await File.findByIdAndDelete(req.params.id);
            req.flash('success', 'Fichier supprimé avec succès!');
        } else {
            req.flash('error', 'Fichier non trouvé.');
        }
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la suppression du fichier.');
    }
    res.redirect('/files');
});

module.exports = router;
