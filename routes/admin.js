const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Middleware pour vérifier si l'utilisateur est admin
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return res.redirect('/login');
}

// Route pour afficher les fichiers de tous les utilisateurs
router.get('/admin', isAdmin, (req, res) => {
  const userDirs = fs.readdirSync(path.join(__dirname, '../uploads'));
 
  let userFiles = {};
  userDirs.forEach(user => {
    const files = fs.readdirSync(path.join(__dirname, '../uploads', user));
    userFiles[user] = files;
  });

  res.render('admin', { userFiles });
});


// Route pour supprimer un fichier d'un utilisateur
router.post('/admin/delete/:user/:file', isAdmin, (req, res) => {
  const userDir = path.join(__dirname, '../uploads', req.params.user);
  const filePath = path.join(userDir, req.params.file);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).send('Erreur lors de la suppression du fichier');
    }
    res.redirect('/admin');
  });
});

module.exports = router;
