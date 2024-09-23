const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Route pour afficher l'espace de dépôt
router.get('/', (req, res) => {
  const directoryPath = path.join(__dirname, '../uploads');

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      req.flash('error', 'Erreur lors du chargement des fichiers.');
      return res.redirect('/'); // Redirige vers la page d'accueil si erreur
    }
    
    // Crée une liste de fichiers
    res.render('home', { files: files, user: req.user, messages: req.flash() });
  });
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
