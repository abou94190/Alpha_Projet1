const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configuration de multer pour le téléchargement de fichiers
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Nom unique pour chaque fichier
  }
});

const upload = multer({ storage: storage });
// Route pour afficher la page des ressources
router.get('/resources', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.render('resources', { user: req.user });
});

// Route pour afficher la page d'upload
router.get('/upload', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.render('upload', { user: req.user });
});

// Route pour uploader un fichier
router.post('/upload', upload.single('projectFile'), (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  // Le fichier a été uploadé
  res.redirect('/files');
});

// Route pour lister les fichiers uploadés
router.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  const uploadPath = path.join(__dirname, '../uploads');
  fs.readdir(uploadPath, (err, files) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur lors du chargement des fichiers');
    }

    res.render('home', { user: req.user, files });
  });
});

// Route pour supprimer un fichier
router.post('/delete/:filename', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);

  // Vérifier si le fichier existe avant de le supprimer
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`Fichier non trouvé : ${filename}`);
      return res.status(404).send('Fichier non trouvé');
    }

    // Supprimer le fichier
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Erreur lors de la suppression du fichier : ${filename}`, err);
        return res.status(500).send('Erreur lors de la suppression du fichier');
      }

      console.log(`Fichier supprimé : ${filename}`);
      res.redirect('/files'); // Rediriger vers la liste des fichiers après suppression
    });
  });
});

module.exports = router;
