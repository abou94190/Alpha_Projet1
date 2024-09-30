const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File');
const Project = require('../models/Project');
const exceljs = require('exceljs');
const isAuthenticated = require('../middleware/authMiddleware');
const { getLdapGroupOU } = require('../ldapservice/ldapService');
const ldap = require('ldapjs');
const { promisify } = require('util');


let manualUsers = [];

// Configuration LDAP
const ldapConfig = {
    url: 'ldap://192.168.1.21:389',
    baseDN: 'DC=workshop,DC=local',
    username: 'CN=Administrateur,CN=Users,DC=workshop,DC=local',
    password: 'Epsi2022!'
};

function promisifyLdap(client) {
    return ['bind', 'add', 'modify', 'search'].reduce((acc, method) => {
        acc[`${method}Async`] = promisify(client[method]).bind(client);
        return acc;
    }, {});
}

async function createLDAPClient() {
    const client = ldap.createClient({ url: ldapConfig.url });
    const bindAsync = promisify(client.bind).bind(client);

    try {
        await bindAsync(ldapConfig.username, ldapConfig.password);
        console.log('Connexion LDAP réussie');
        return client;
    } catch (error) {
        console.error('Erreur de connexion LDAP:', error);
        throw error;
    }
}

async function createLDAPUser(client, userDN, userAttributes) {
    const addAsync = promisify(client.add).bind(client);
    try {
        await addAsync(userDN, userAttributes);
        console.log('Utilisateur LDAP créé avec succès');
    } catch (error) {
        console.error('Erreur lors de la création de l utilisateur LDAP:', error);
        throw error;
    }
}


// Fonction pour vérifier l'existence d'un objet LDAP
async function checkLDAPObjectExists(ldapAsync, dn) {
    try {
        const res = await ldapAsync.searchAsync(dn, { scope: 'base' });
        return new Promise((resolve) => {
            res.on('searchEntry', () => resolve(true));
            res.on('end', () => resolve(false));
        });
    } catch (error) {
        console.error(`Erreur lors de la vérification de l'existence de ${dn}:`, error);
        return false;
    }
}
// Fonction pour vérifier la connexion et effectuer une recherche de base
async function testLDAPConnection() {
    const client = await createLDAPClient();
    const searchAsync = promisify(client.search).bind(client);

    try {
        const result = await searchAsync(ldapConfig.baseDN, {
            scope: 'base',
            filter: '(objectClass=*)'
        });

        return new Promise((resolve, reject) => {
            result.on('searchEntry', (entry) => {
                console.log('Entrée trouvée:', entry.object);
                resolve(true);
            });
            result.on('error', (err) => {
                console.error('Erreur de recherche:', err);
                reject(err);
            });
            result.on('end', (result) => {
                if (result.status !== 0) {
                    console.error('Recherche terminée avec statut:', result.status);
                    reject(new Error(`Recherche terminée avec statut: ${result.status}`));
                } else {
                    resolve(false);
                }
            });
        });
    } finally {
        client.unbind();
    }
}
// Exemple d'utilisation dans une route
router.get('/test-ldap', async (req, res) => {
    try {
        const result = await testLDAPConnection();
        res.send(`Test LDAP réussi: ${result}`);
    } catch (error) {
        console.error('Erreur lors du test LDAP:', error);
        res.status(500).send(`Erreur LDAP: ${error.message}`);
    }
});

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
            filter: '(objectClass=*)', // Élargir la recherche à tous les objets
            scope: 'sub',
            attributes: ['sAMAccountName', 'displayName', 'objectClass', 'distinguishedName']
        };

        console.log('Démarrage de la recherche LDAP pour les utilisateurs avec les options:', JSON.stringify(opts));
        console.log('BaseDN utilisé:', baseDN);

        client.search(baseDN, opts, (err, res) => {
            if (err) {
                console.error('Erreur lors de l\'initialisation de la recherche LDAP des utilisateurs:', err);
                reject(err);
                return;
            }

            const users = [];
            let entryCount = 0;

            res.on('searchEntry', (entry) => {
                entryCount++;
                console.log('Entrée LDAP brute:', JSON.stringify(entry, null, 2));
                
                if (entry && entry.object) {
                    const objectClasses = Array.isArray(entry.object.objectClass) 
                        ? entry.object.objectClass 
                        : [entry.object.objectClass];

                    // Vérifier si l'objet est un utilisateur
                    if (objectClasses.includes('user') || objectClasses.includes('person')) {
                        const user = {
                            sAMAccountName: entry.object.sAMAccountName || 'Nom inconnu',
                            displayName: entry.object.displayName || entry.object.sAMAccountName || 'Nom d\'affichage inconnu',
                            objectClass: objectClasses,
                            distinguishedName: entry.object.distinguishedName
                        };
                        users.push(user);
                        console.log('Utilisateur ajouté:', JSON.stringify(user));
                    } else {
                        console.log('Objet non-utilisateur trouvé:', entry.object.distinguishedName);
                    }
                } else {
                    console.warn('Entrée LDAP invalide:', entry);
                }
            });

            res.on('searchReference', (referral) => {
                console.log('Référence de recherche reçue:', referral.uris.join());
            });

            res.on('error', (err) => {
                console.error('Erreur lors de la recherche des utilisateurs:', err);
                reject(err);
            });

            res.on('end', (result) => {
                console.log(`Recherche terminée. Résultat:`, result);
                console.log(`Total des entrées trouvées: ${entryCount}`);
                console.log(`Utilisateurs valides trouvés: ${users.length}`);
                resolve(users);
            });
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
router.post('/delete-project/:id', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    try {
        const projectId = req.params.id;
        const deletedProject = await Project.findByIdAndDelete(projectId);

        if (!deletedProject) {
            req.flash('error', 'Projet non trouvé');
        } else {
            req.flash('success', 'Projet supprimé avec succès');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du projet:', error);
        req.flash('error', 'Erreur lors de la suppression du projet');
    }

    res.redirect('/files/resources');
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

router.post('/add-user', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    const { username, displayName, password, ouPath } = req.body;
    if (!username || !displayName || !password || !ouPath) {
        req.flash('error', 'Tous les champs sont requis');
        return res.redirect('/files/manage-groups');
    }

    let client;
    try {
        client = await createLDAPClient();

        const userDN = `CN=${username},${ouPath}`;
        const userAttributes = {
            cn: username,
            sn: displayName,
            objectClass: ['top', 'person', 'organizationalPerson', 'user'],
            sAMAccountName: username,
            userPrincipalName: `${username}@workshop.local`,
            displayName: displayName,
            userAccountControl: '66048', // Normal account, password never expires
            unicodePwd: Buffer.from(`"${password}"`, 'utf16le').toString()
        };

        await createLDAPUser(client, userDN, userAttributes);

        req.flash('success', 'Utilisateur ajouté avec succès');
    } catch (error) {
        console.error('Erreur lors de l ajout de l utilisateur:', error);
        req.flash('error', `Erreur lors de l'ajout de l'utilisateur: ${error.message}`);
    } finally {
        if (client) {
            client.unbind();
        }
        res.redirect('/files/manage-groups');
    }
});

// Route pour supprimer un utilisateur manuellement
router.post('/remove-user', isAuthenticated, (req, res) => {
    const { username } = req.body;
    manualUsers = manualUsers.filter(user => user.username !== username);
    req.flash('success', 'Utilisateur supprimé avec succès');
    res.redirect('/files/manage-groups');
});
// Route pour afficher la page de gestion des groupes
router.get('/manage-groups', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    try {
        const client = ldap.createClient({ url: ldapConfig.url });
        await new Promise((resolve, reject) => {
            client.bind(ldapConfig.username, ldapConfig.password, err => {
                if (err) reject(err);
                else resolve();
            });
        });

        const [groups, ous] = await Promise.all([
            getGroups(client, ldapConfig.baseDN),
            getOUs(client, ldapConfig.baseDN)
        ]);

        client.unbind();

        res.render('manage-groups', { groups, ous, manualUsers });
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de la récupération des données');
        res.status(500).send('Erreur serveur');
    }
});

// Route pour créer un nouveau groupe
router.post('/create-group', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    const { groupName, ouPath } = req.body;
    const client = ldap.createClient({ url: ldapConfig.url });
    const ldapAsync = promisifyLdap(client);

    try {
        await ldapAsync.bindAsync(ldapConfig.username, ldapConfig.password);

        const groupDN = `CN=${groupName},${ouPath}`;
        const entry = {
            cn: groupName,
            objectClass: ['top', 'group'],
            sAMAccountName: groupName,
            groupType: '-2147483646'
        };

        await ldapAsync.addAsync(groupDN, entry);
        req.flash('success', `Le groupe "${groupName}" a été créé avec succès`);
    } catch (error) {
        console.error('Erreur lors de la création du groupe:', error);
        req.flash('error', `Erreur lors de la création du groupe: ${error.message}`);
    } finally {
        client.unbind();
        res.redirect('/files/manage-groups');
    }
});

router.post('/add-users-to-group', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    const { existingGroup, usernames } = req.body;
    console.log('Groupe sélectionné:', existingGroup);
    console.log('Utilisateurs à ajouter:', usernames);

    const client = ldap.createClient({ url: ldapConfig.url });
    const ldapAsync = promisifyLdap(client);

    try {
        await ldapAsync.bindAsync(ldapConfig.username, ldapConfig.password);
        console.log('Connexion LDAP réussie');

        console.log('Configuration LDAP utilisée:');
        console.log('URL:', ldapConfig.url);
        console.log('Base DN:', ldapConfig.baseDN);
        console.log('Username:', ldapConfig.username);

        const logEntry = (entry) => {
            console.log('DN:', entry.dn);
            if (entry.attributes) {
                entry.attributes.forEach(attr => {
                    console.log(`${attr.type}:`, attr.values);
                });
            }
        };

        // Lister tous les utilisateurs
        console.log('Recherche de tous les utilisateurs:');
        try {
            const allUsersResult = await ldapAsync.searchAsync(ldapConfig.baseDN, {
                scope: 'sub',
                filter: '(&(objectClass=user)(objectCategory=person))',
                attributes: ['dn', 'sAMAccountName', 'cn', 'displayName'],
                sizeLimit: 1000
            });

            console.log(`Nombre total d'utilisateurs trouvés: ${allUsersResult.entries ? allUsersResult.entries.length : 0}`);
            
            if (allUsersResult.entries && allUsersResult.entries.length > 0) {
                console.log('Échantillon de 5 utilisateurs:');
                allUsersResult.entries.slice(0, 5).forEach(logEntry);
            } else {
                console.log('Aucun utilisateur trouvé');
            }
        } catch (searchError) {
            console.error('Erreur lors de la recherche de tous les utilisateurs:', searchError);
        }

        // Recherche des utilisateurs spécifiques
        const users = usernames.split(',').map(username => username.trim());
        for (const user of users) {
            console.log(`Recherche de l'utilisateur spécifique: ${user}`);
            try {
                const userResult = await ldapAsync.searchAsync(ldapConfig.baseDN, {
                    scope: 'sub',
                    filter: `(&(objectClass=user)(|(sAMAccountName=${user})(cn=${user})(displayName=${user})))`,
                    attributes: ['dn', 'sAMAccountName', 'cn', 'displayName']
                });

                if (userResult.entries && userResult.entries.length > 0) {
                    console.log(`Utilisateur "${user}" trouvé:`);
                    logEntry(userResult.entries[0]);
                } else {
                    console.log(`Aucun résultat pour l'utilisateur "${user}"`);
                }
            } catch (userSearchError) {
                console.error(`Erreur lors de la recherche de l'utilisateur "${user}":`, userSearchError);
            }
        }

        // Ne pas essayer d'ajouter les utilisateurs pour le moment
        throw new Error("Test de recherche terminé. Aucune modification de groupe effectuée.");

    } catch (error) {
        console.error('Erreur détaillée:', error);
        req.flash('error', `Erreur: ${error.message}`);
    } finally {
        client.unbind();
        res.redirect('/files/manage-groups');
    }
});

router.post('/delete-group', isAuthenticated, async (req, res) => {
    if (!req.user.isProf) {
        return res.status(403).send('Accès refusé');
    }

    const { groupDN } = req.body;
    const client = ldap.createClient({ url: ldapConfig.url });
    const ldapAsync = promisifyLdap(client);

    try {
        await ldapAsync.bindAsync(ldapConfig.username, ldapConfig.password);

        await ldapAsync.deleteAsync(groupDN);
        req.flash('success', `Groupe supprimé avec succès`);
    } catch (error) {
        console.error('Erreur lors de la suppression du groupe:', error);
        req.flash('error', `Erreur lors de la suppression du groupe: ${error.message}`);
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