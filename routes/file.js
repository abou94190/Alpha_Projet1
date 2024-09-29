const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File');
const Project = require('../models/Project');
const exceljs = require('exceljs');
const isAuthenticated = require('../middleware/authMiddleware');
const { getLdapGroupOU } = require('../ldapservice/ldapService');
const ldap = require('ldapjs');

// Configuration LDAP
const ldapConfig = {
    url: 'ldap://192.168.1.21:389',
    baseDN: 'DC=workshop,DC=local',
    username: 'CN=Administrateur,CN=Users,DC=workshop,DC=local',
    password: 'Epsi2022!'
};

const addUsersToGroup = (client, groupDN, users, ouPath) => {
    return new Promise((resolve, reject) => {
        if (!users || users.length === 0) {
            return resolve();
        }

        const userDNs = users.split(',').map(user => `CN=${user},${ouPath}`);
        const changes = {
            operation: 'add',
            modification: {
                member: userDNs
            }
        };

        client.modify(groupDN, changes, (err) => {
            if (err) {
                console.error('Erreur lors de l\'ajout des utilisateurs au groupe:', err);
                reject(err);
            } else {
                console.log('Utilisateurs ajoutés avec succès au groupe');
                resolve();
            }
        });
    });
};
function getUsers(client, baseDN) {
    return new Promise((resolve, reject) => {
        const opts = {
            filter: '(&(objectClass=user)(!(objectClass=computer)))',
            scope: 'sub',
            attributes: ['sAMAccountName', 'displayName']
        };

        client.search(baseDN, opts, (err, res) => {
            if (err) {
                reject(err);
                return;
            }

            const users = [];
            res.on('searchEntry', (entry) => {
                const user = {
                    sAMAccountName: entry.object.sAMAccountName,
                    displayName: entry.object.displayName || entry.object.sAMAccountName
                };
                users.push(user);
            });

            res.on('error', reject);
            res.on('end', () => resolve(users));
        });
    });
}

// Fonction pour extraire le nom du groupe et l'OU à partir de l'entrée LDAP
function extractGroupInfo(entry) {
    let name = 'Nom inconnu';
    let ou = 'OU inconnue';

    if (entry.object) {
        name = entry.object.cn || entry.object.name || name;
        
        if (entry.object.distinguishedName) {
            const dnParts = entry.object.distinguishedName.split(',');
            const ouPart = dnParts.find(part => part.startsWith('OU='));
            ou = ouPart ? ouPart.split('=')[1] : ou;
        }
    } else if (entry.attributes) {
        const cnAttr = entry.attributes.find(attr => attr.type === 'cn');
        name = cnAttr ? cnAttr.values[0] : name;

        const dnAttr = entry.attributes.find(attr => attr.type === 'distinguishedName');
        if (dnAttr) {
            const dnParts = dnAttr.values[0].split(',');
            const ouPart = dnParts.find(part => part.startsWith('OU='));
            ou = ouPart ? ouPart.split('=')[1] : ou;
        }
    }

    return { name, ou };
}

// Fonction pour extraire le DN d'une entrée LDAP
function getDN(entry) {
    if (typeof entry.dn === 'string') {
        return entry.dn;
    } else if (entry.dn && typeof entry.dn.toString === 'function') {
        return entry.dn.toString();
    } else if (entry.distinguishedName) {
        return entry.distinguishedName;
    } else {
        console.warn('Impossible de trouver le DN pour l\'entrée:', entry);
        return null;
    }
}

// Fonction pour récupérer les OUs
function getOUs(client, baseDN) {
    return new Promise((resolve, reject) => {
        const opts = {
            filter: '(|(objectClass=organizationalUnit)(objectClass=container))',
            scope: 'sub',
            attributes: ['ou', 'name', 'distinguishedName']
        };

        console.log('Démarrage de la recherche LDAP avec les options:', opts);

        client.search(baseDN, opts, (err, res) => {
            if (err) {
                console.error('Erreur lors de l\'initialisation de la recherche LDAP:', err);
                reject(err);
                return;
            }

            const ous = [];
            res.on('searchEntry', (entry) => {
                console.log('Entrée LDAP brute:', JSON.stringify(entry, null, 2));
                
                let entryData = entry.object || entry;
                console.log('Entrée LDAP traitée:', JSON.stringify(entryData, null, 2));

                const dn = getDN(entryData);
                if (!dn) {
                    return;
                }

                const dnParts = dn.split(',');
                const ouName = dnParts[0].split('=')[1];

                ous.push({
                    name: ouName,
                    dn: dn
                });
                console.log('OU ajoutée:', ous[ous.length - 1]);
            });

            res.on('error', (err) => {
                console.error('Erreur lors de la recherche LDAP:', err);
                reject(err);
            });

            res.on('end', (result) => {
                console.log('Recherche LDAP terminée. Résultat:', result);
                console.log('OUs trouvées:', ous);
                resolve(ous);
            });
        });
    });
}
function getGroups(client, baseDN) {
    return new Promise((resolve, reject) => {
        const opts = {
            filter: '(&(objectClass=group)(!(objectClass=computer)))',
            scope: 'sub',
            attributes: ['cn', 'distinguishedName']
        };

        client.search(baseDN, opts, (err, res) => {
            if (err) {
                console.error('Erreur lors de la recherche LDAP:', err);
                reject(err);
                return;
            }

            const groups = [];
            res.on('searchEntry', (entry) => {
                console.log('Entrée LDAP brute:', JSON.stringify(entry, null, 2));

                let dn, name, ou;

                // Tentative d'extraction du DN
                if (entry.dn && typeof entry.dn === 'string') {
                    dn = entry.dn;
                } else if (entry.dn && typeof entry.dn.toString === 'function') {
                    dn = entry.dn.toString();
                } else if (entry.objectName && typeof entry.objectName === 'string') {
                    dn = entry.objectName;
                } else {
                    console.warn('DN non trouvé ou non valide dans l\'entrée:', entry);
                    return; // Passer à l'entrée suivante
                }

                // Extraction du nom (CN)
                if (entry.attributes) {
                    const cnAttribute = entry.attributes.find(attr => attr.type === 'cn');
                    name = cnAttribute && cnAttribute.vals && cnAttribute.vals.length > 0 ? cnAttribute.vals[0] : 'Nom inconnu';
                } else if (entry.object && entry.object.cn) {
                    name = entry.object.cn;
                } else {
                    name = 'Nom inconnu';
                }

                // Extraction de l'OU
                const ouMatch = dn.match(/OU=([^,]+)/i);
                ou = ouMatch ? ouMatch[1] : 'OU inconnue';

                console.log(`Groupe traité - Nom: ${name}, OU: ${ou}, DN: ${dn}`);
                groups.push({ name, ou, dn });
            });

            res.on('error', (err) => {
                console.error('Erreur lors de la recherche:', err);
                reject(err);
            });

            res.on('end', (result) => {
                console.log('Recherche terminée. Groupes trouvés:', groups.length);
                resolve(groups);
            });
        });
    });
}

router.use(isAuthenticated);

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route pour afficher la page des fichiers
router.get('/', async (req, res) => {
    const user = req.user;
    if (user.isProf) {
        return res.redirect('/files/resources');
    }
    
    try {
        const userGroups = Array.isArray(user.memberOf) ? user.memberOf.map(g => g.split(',')[0].split('=')[1]) : [];
        let files;

        if (user.isAdmin) {
            files = await File.find();
        } else {
            files = await File.find({
                $or: [
                    { uploadedBy: user.sAMAccountName },
                    { uploadedByGroup: { $in: user.memberOf } }
                ]
            });
        }

        const userOU = user.dn.match(/OU=([^,]+)/)[1];
        const projects = await Project.find({ assignedOU: userOU });

        res.render('files', { user, files, projects });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des fichiers et des projets.');
        res.redirect('/');
    }
});

// Route pour afficher les ressources (vue professeur)
router.get('/resources', async (req, res) => {
    const user = req.user;
    try {
        if (!user.isProf) {
            return res.status(403).send('Accès refusé');
        }

        const userGroups = Array.isArray(user.memberOf) ? user.memberOf : [];
        const resources = await File.find({ uploadedByGroup: { $in: userGroups } });
        const selectedOU = req.query.ou || '';
        const projects = await Project.find({ createdBy: user.sAMAccountName });

        res.render('resources', { 
            user: req.user, 
            resources, 
            selectedOU, 
            projects,
            isProf: req.user.isProf // Ajoutez cette ligne
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la récupération des ressources et des projets.');
        res.redirect('/files');
    }
});

// Route pour donner une note à un groupe
router.post('/resources/group-notes', async (req, res) => {
    const { resourceId, groupName, note } = req.body;

    try {
        const resource = await File.findById(resourceId);

        if (!resource) {
            req.flash('error', 'Ressource non trouvée.');
            return res.redirect('/files/resources');
        }

        resource.notes.set(groupName, note);
        await resource.save();

        req.flash('success', 'Note enregistrée avec succès.');
        res.redirect('/files/resources');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la note :', error);
        req.flash('error', 'Erreur lors de l\'enregistrement de la note.');
        res.redirect('/files/resources');
    }
});

// Route pour supprimer une note d'un groupe
router.post('/resources/delete-note', async (req, res) => {
    const { resourceId, groupName } = req.body;

    try {
        const resource = await File.findById(resourceId);

        if (!resource) {
            req.flash('error', 'Ressource non trouvée.');
            return res.redirect('/files/resources');
        }

        resource.notes.delete(groupName);
        await resource.save();

        req.flash('success', 'Note supprimée avec succès.');
        res.redirect('/files/resources');
    } catch (error) {
        console.error('Erreur lors de la suppression de la note :', error);
        req.flash('error', 'Erreur lors de la suppression de la note.');
        res.redirect('/files/resources');
    }
});

// Route pour uploader un fichier
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(403).send('Accès refusé');
        }

        const ouMatch = user.dn.match(/OU=([^,]+)/);
        const uploadedByOU = ouMatch ? ouMatch[1] : 'Inconnu';

        const newFile = new File({
            filename: req.file.originalname,
            buffer: req.file.buffer,
            uploadedBy: user.sAMAccountName,
            uploadedByGroup: user.memberOf,
            uploadedByOU: uploadedByOU
        });

        await newFile.save();

        console.log('Fichier uploadé avec succès :', newFile);
        res.redirect('/files');
    } catch (error) {
        console.error('Erreur lors de l\'upload du fichier :', error);
        res.status(500).send('Erreur lors de l\'upload du fichier');
    }
});

// Route pour supprimer un fichier
router.post('/delete/:id', async (req, res) => {
    try {
        await File.findByIdAndDelete(req.params.id);
        req.flash('success', 'Fichier supprimé avec succès!');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la suppression du fichier.');
    }
    res.redirect('/files');
});

// Route pour télécharger les notes des groupes
router.post('/resources/download-notes', async (req, res) => {
    try {
        const files = await File.find();

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Notes des groupes');

        worksheet.columns = [
            { header: 'Classe (OU)', key: 'ou', width: 20 },
            { header: 'Nom de la ressource', key: 'filename', width: 30 },
            { header: 'Appréciation', key: 'appreciation', width: 30 },
            { header: 'Note', key: 'note', width: 10 },
        ];

        for (const file of files) {
            if (file.notes && file.notes.size > 0) {
                for (const [appreciation, note] of file.notes) {
                    worksheet.addRow({
                        ou: file.uploadedByOU || 'Non spécifié',
                        filename: file.filename,
                        appreciation: appreciation,
                        note: note
                    });
                }
            }
        }

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        worksheet.autoFilter = 'A1:D1';
        worksheet.getColumn('A').numFmt = '@';
        worksheet.getColumn('D').numFmt = '0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=notes_par_classe.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erreur lors de la génération du fichier Excel :', error);
        req.flash('error', 'Erreur lors de la génération du fichier Excel.');
        res.redirect('/files/resources');
    }
});

// Route pour afficher la page de création de projet
router.get('/create-project', isAuthenticated, (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }
    res.render('create-project', { user: req.user });
});

// Route pour créer un nouveau projet
router.post('/create-project', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    try {
        const { title, description, deadline, assignedOU } = req.body;
        const newProject = new Project({
            title,
            description,
            deadline,
            createdBy: req.user.sAMAccountName,
            assignedOU
        });
        await newProject.save();
        req.flash('success', 'Projet créé avec succès');
        res.redirect('/files/resources');
    } catch (error) {
        console.error('Erreur lors de la création du projet:', error);
        req.flash('error', 'Erreur lors de la création du projet');
        res.redirect('/files/resources');
    }
});

// Route pour soumettre un projet
router.post('/submit-project/:projectId', upload.single('file'), async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) {
            req.flash('error', 'Projet non trouvé');
            return res.redirect('/files');
        }

        const newFile = new File({
            filename: req.file.originalname,
            buffer: req.file.buffer,
            uploadedBy: req.user.sAMAccountName,
            uploadedByGroup: req.user.memberOf,
            uploadedByOU: req.user.dn.match(/OU=([^,]+)/)[1]
        });
        await newFile.save();

        project.submissions.push({
            studentName: req.user.sAMAccountName,
            fileId: newFile._id,
            submittedAt: new Date()
        });
        await project.save();

        req.flash('success', 'Projet soumis avec succès');
        res.redirect('/files');
    } catch (error) {
        console.error('Erreur lors de la soumission du projet:', error);
        req.flash('error', 'Erreur lors de la soumission du projet');
        res.redirect('/files');
    }
});


router.get('/manage-groups', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    try {
        const client = ldap.createClient({
            url: ldapConfig.url
        });

        await new Promise((resolve, reject) => {
            client.bind(ldapConfig.username, ldapConfig.password, (err) => {
                if (err) {
                    console.error('Erreur de connexion LDAP:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        const groups = await getGroups(client, ldapConfig.baseDN);
        const ous = await getOUs(client, ldapConfig.baseDN);

        client.unbind();

        // Trier les groupes par OU
        groups.sort((a, b) => a.ou.localeCompare(b.ou));

        res.render('manage-groups', { groups, ous });
    } catch (error) {
        console.error('Erreur lors de la récupération des groupes:', error);
        req.flash('error', 'Erreur lors de la récupération des groupes');
        res.status(500).send('Erreur serveur');
    }
});

router.post('/create-group', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    const { groupName, ouPath, users } = req.body;
    console.log('Tentative de création de groupe:', { groupName, ouPath, users });

    const client = ldap.createClient({ url: ldapConfig.url });

    try {
        await new Promise((resolve, reject) => {
            client.bind(ldapConfig.username, ldapConfig.password, (err) => {
                if (err) {
                    console.error('Erreur de connexion LDAP:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        // Vérifier si l'OU existe
        const searchResult = await new Promise((resolve, reject) => {
            client.search(ouPath, { scope: 'base' }, (searchErr, searchRes) => {
                if (searchErr) {
                    reject(searchErr);
                } else {
                    let ouExists = false;
                    searchRes.on('searchEntry', () => { ouExists = true; });
                    searchRes.on('error', reject);
                    searchRes.on('end', () => resolve(ouExists));
                }
            });
        });

        if (!searchResult) {
            throw new Error(`L'OU spécifiée n'existe pas: ${ouPath}`);
        }

        // Créer le groupe
        const groupDN = `CN=${groupName},${ouPath}`;
        const entry = {
            cn: groupName,
            objectClass: ['top', 'group'],
            sAMAccountName: groupName,
            groupType: '-2147483646' // Groupe de sécurité global
        };

        await new Promise((resolve, reject) => {
            client.add(groupDN, entry, (addErr) => {
                if (addErr) {
                    reject(addErr);
                } else {
                    resolve();
                }
            });
        });

        console.log('Groupe créé avec succès:', groupDN);

        // Ajouter les utilisateurs au groupe
        if (users) {
            await addUsersToGroup(client, groupDN, users, ouPath);
        }

        req.flash('success', `Le groupe "${groupName}" a été créé avec succès dans ${ouPath}`);
    } catch (error) {
        console.error('Erreur lors de la création du groupe:', error);
        req.flash('error', `Erreur lors de la création du groupe: ${error.message}`);
    } finally {
        client.unbind();
        res.redirect('/files/manage-groups');
    }
});

// Route pour noter un projet soumis
router.post('/grade-project/:projectId/:submissionId', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    try {
        const { projectId, submissionId } = req.params;
        const { grade, feedback } = req.body;

        const project = await Project.findById(projectId);
        if (!project) {
            req.flash('error', 'Projet non trouvé');
            return res.redirect('/files/resources');
        }

        const submissionIndex = project.submissions.findIndex(sub => sub._id.toString() === submissionId);
        if (submissionIndex === -1) {
            req.flash('error', 'Soumission non trouvée');
            return res.redirect('/files/resources');
        }

        // Mise à jour de la soumission
        project.submissions[submissionIndex].grade = grade;
        project.submissions[submissionIndex].feedback = feedback;

        await project.save();

        req.flash('success', 'Note attribuée avec succès');
        res.redirect('/files/resources');
    } catch (error) {
        console.error('Erreur lors de la notation du projet:', error);
        req.flash('error', 'Erreur lors de la notation du projet');
        res.redirect('/files/resources');
    }
});

module.exports = router;