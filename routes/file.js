const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Assure-toi d'importer fs

// Configuration de Multer pour le téléchargement de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Assure-toi que ce dossier existe
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nom unique pour le fichier
  }
});

const upload = multer({ storage });

// Page pour afficher les fichiers
router.get('/', (req, res) => {
  const user = req.user || { cn: 'Invité' }; // Remplace par ta logique d'utilisateur
  const files = fs.readdirSync(path.join(__dirname, '../uploads')); // Lire les fichiers dans le dossier uploads
  res.render('files', { user, files }); // Passe user et files à la vue
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
