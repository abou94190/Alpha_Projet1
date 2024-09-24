const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const isAuthenticated = require('../middleware/authmiddleware'); // Importer le middleware

// Utiliser le middleware d'authentification
router.use(isAuthenticated);

// Configuration de Multer pour le téléchargement de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Assure-toi que ce dossier existe
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Route pour afficher la page des fichiers
router.get('/', (req, res) => {
  const user = req.user; // Utilisateur authentifié
  const files = fs.readdirSync(path.join(__dirname, '../uploads')); // Lire les fichiers dans le dossier uploads

  // Filtrer les fichiers indésirables
  const filteredFiles = files.filter(file => !['login.ejs', 'resources.ejs', 'upload.ejs'].includes(file));

  res.render('files', { user, files: filteredFiles }); // Rendre la vue avec les fichiers filtrés
});

// Route pour uploader un fichier
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Erreur lors du chargement du fichier.');
    return res.redirect('/files');
  }
  req.flash('success', 'Fichier chargé avec succès!');
  res.redirect('/files');
});

// Route pour afficher les ressources
router.get('/resources', (req, res) => {
  const user = req.user; // Gère l'utilisateur
  const files = fs.readdirSync(path.join(__dirname, '../uploads')); // Lire les fichiers dans le dossier uploads

  // Filtrer les fichiers indésirables
  const filteredResources = files.filter(file => !['login.ejs', 'resources.ejs', 'upload.ejs'].includes(file));

  res.render('resources', { user, files: filteredResources }); // Rendre la vue resources.ejs avec les fichiers filtrés
});

// Route pour télécharger un fichier
router.get('/download/:filename', (req, res) => {
  const file = path.join(__dirname, '../uploads', req.params.filename);
  res.download(file);
});

// Route pour supprimer un fichier
router.post('/delete/:filename', (req, res) => {
  const file = path.join(__dirname, '../uploads', req.params.filename);
  fs.unlink(file, (err) => {
    if (err) {
      req.flash('error', 'Erreur lors de la suppression du fichier.');
      return res.redirect('/files');
    }
    req.flash('success', 'Fichier supprimé avec succès!');
    res.redirect('/files');
  });
});

module.exports = router;