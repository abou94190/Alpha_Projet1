// ldapService.js
const ldap = require('ldapjs');

// Configuration de l'authentification LDAP
const ldapClient = ldap.createClient({
    url: 'ldap://192.168.1.21:389' // Remplacez par l'URL de votre serveur LDAP
});

// Authentification
ldapClient.bind('CN=Administrateur,CN=Users,DC=workshop,DC=local', 'Epsi2022!', (err) => {
    if (err) {
        console.error('Erreur lors de la connexion LDAP:', err);
    } else {
        console.log('Connexion LDAP réussie');
    }
});

// Fonction pour récupérer l'OU d'un groupe via LDAP
async function getLdapGroupOU(groupName) {
    return new Promise((resolve, reject) => {
        const searchOptions = {
            filter: `(&(objectClass=group)(cn=${groupName}))`,
            scope: 'sub',
            attributes: ['member']
        };

        console.log('Recherche avec les options :', searchOptions);

        ldapClient.search('DC=workshop,DC=local', searchOptions, (err, res) => {
            if (err) {
                console.error('Erreur lors de la recherche LDAP:', err);
                return reject(err);
            }

            const ouList = []; // Liste pour stocker les OU

            res.on('searchEntry', (entry) => {
                console.log('Entrée trouvée :', entry);
                if (entry.object && entry.object.member) {
                    const memberDNs = entry.object.member; // Récupérer les DN des membres
                    if (Array.isArray(memberDNs)) {
                        memberDNs.forEach(dn => {
                            const ouMatch = dn.match(/OU=([^,]+)/); // Extraire l'OU du DN
                            if (ouMatch) {
                                ouList.push(ouMatch[1]); // Ajouter l'OU à la liste
                            }
                        });
                    } else {
                        const ouMatch = memberDNs.match(/OU=([^,]+)/); // Extraire l'OU du DN
                        if (ouMatch) {
                            ouList.push(ouMatch[1]); // Ajouter l'OU à la liste
                        }
                    }
                } else {
                    console.warn(`Aucun membre trouvé pour le groupe ${groupName}`);
                }
            });

            res.on('end', (result) => {
                console.log('Recherche terminée:', result);
                console.log('OU trouvés:', ouList);
                resolve(ouList); // Retourner la liste des OU
            });

            res.on('error', (error) => {
                console.error('Erreur lors de la recherche:', error);
                reject(error);
            });
        });
    });
}

// Exporter la fonction
module.exports = { getLdapGroupOU }; // Assurez-vous que getLdapGroupMembers est également défini
