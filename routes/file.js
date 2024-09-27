const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File'); // Importer le modèle
const exceljs = require('exceljs'); // Importer exceljs pour générer des fichiers Excel
const isAuthenticated = require('../middleware/authMiddleware');
const { getLdapGroupOU } = require('../ldapservice/ldapService');

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
        const userGroups = Array.isArray(user.memberOf) ? user.memberOf.map(g => g.split(',')[0].split('=')[1]) : [];
        let files;

        if (user.isAdmin) {
            files = await File.find(); // Les administrateurs peuvent voir tous les fichiers
        } else {
            // Récupérer les fichiers uploadés par l'utilisateur ou partagés avec leurs groupes
            files = await File.find({
                $or: [
                    { uploadedBy: user.sAMAccountName }, // Fichiers uploadés par l'utilisateur
                    { uploadedByGroup: { $in: user.memberOf } } // Fichiers partagés avec les groupes de l'utilisateur
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

//// Route pour afficher les ressources
router.get('/resources', async (req, res) => {
    const user = req.user;
    try {
        // Vérifiez si l'utilisateur est un professeur
        if (!user.isProf) {
            return res.status(403).send('Accès refusé');
        }

        // Récupérer les groupes de l'utilisateur
        const userGroups = Array.isArray(user.memberOf) ? user.memberOf : [];

        // Récupérer les fichiers uploadés par les membres de son groupe LDAP
        const resources = await File.find({ uploadedByGroup: { $in: userGroups } });

        // Récupérer l'OU sélectionnée à partir des requêtes, sinon définir une valeur par défaut
        const selectedOU = req.query.ou || ''; // Assurez-vous qu'il est toujours défini comme une chaîne vide si non présent

        res.render('resources', { user: req.user, resources, selectedOU }); // Passer les ressources et l'OU sélectionnée à la vue
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des ressources.');
        res.redirect('/files'); // Rediriger en cas d'erreur
    }
});



// Route pour donner une note à un groupe
router.post('/resources/group-notes', async (req, res) => {
    const { resourceId, groupName, note } = req.body; // Récupérer les données du formulaire

    try {
        const resource = await File.findById(resourceId); // Trouver la ressource par ID

        if (!resource) {
            req.flash('error', 'Ressource non trouvée.');
            return res.redirect('/files/resources');
        }

        // Ajouter ou mettre à jour la note pour le groupe
        resource.notes.set(groupName, note);
        await resource.save(); // Enregistrer les modifications

        req.flash('success', 'Note enregistrée avec succès.');
        res.redirect('/files/resources'); // Rediriger vers la page des ressources
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la note :', error);
        req.flash('error', 'Erreur lors de l\'enregistrement de la note.');
        res.redirect('/files/resources');
    }
});

// Route pour supprimer une note d'un groupe
router.post('/resources/delete-note', async (req, res) => {
    const { resourceId, groupName } = req.body; // Récupérer les données du formulaire

    try {
        const resource = await File.findById(resourceId); // Trouver la ressource par ID

        if (!resource) {
            req.flash('error', 'Ressource non trouvée.');
            return res.redirect('/files/resources');
        }

        // Supprimer la note pour le groupe
        resource.notes.delete(groupName);
        await resource.save(); // Enregistrer les modifications

        req.flash('success', 'Note supprimée avec succès.');
        res.redirect('/files/resources'); // Rediriger vers la page des ressources
    } catch (error) {
        console.error('Erreur lors de la suppression de la note :', error);
        req.flash('error', 'Erreur lors de la suppression de la note.');
        res.redirect('/files/resources');
    }
});

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

// Route pour rediriger vers Nextcloud après authentification
router.get('/nextcloud', (req, res) => {
    const user = req.user;

    if (!user) {
        console.log('Accès refusé : utilisateur non authentifié');
        return res.status(403).send('Accès refusé');
    }

    // Générer l'URL pour rediriger vers Nextcloud
    const nextcloudUrl = `http://192.168.1.183/login?user=${user.sAMAccountName}`;
    console.log(`Redirection vers Nextcloud : ${nextcloudUrl}`);

    // Rediriger l'utilisateur vers Nextcloud
    res.redirect(nextcloudUrl);
});

// Route pour télécharger les notes des groupes
router.post('/resources/download-notes', async (req, res) => {
    try {
        const files = await File.find(); // Récupérer toutes les ressources

        // Créer un nouveau workbook
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Notes des groupes');

        // Ajouter des en-têtes de colonne
        worksheet.columns = [
            { header: 'Nom de la ressource', key: 'filename', width: 30 },
            { header: 'Appréciation', key: 'group', width: 30 },
            { header: 'Note', key: 'note', width: 10 },
        ];

        // Parcourir chaque ressource pour extraire les notes
        for (const file of files) {
            if (file.notes) {
                for (const [groupName, note] of file.notes) {
                    worksheet.addRow({
                        filename: file.filename,
                        group: groupName,
                        note: note
                    });
                }
            }
        }

        // Configurer la réponse pour télécharger le fichier
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=notes.xlsx');

        // Écrire le fichier Excel dans la réponse
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erreur lors de la génération du fichier Excel :', error);
        req.flash('error', 'Erreur lors de la génération du fichier Excel.');
        res.redirect('/files/resources');
    }
});

module.exports = router;
