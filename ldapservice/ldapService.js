const ldap = require('ldapjs');

// Configuration de l'authentification LDAP
const ldapClient = ldap.createClient({
    url: 'ldap://192.168.1.21:389', // Remplacez par l'URL de votre serveur LDAP
});

// Écouter les événements d'erreur
ldapClient.on('error', (err) => {
    console.error('Erreur de client LDAP:', err);
});

// Authentification
ldapClient.bind('CN=Administrateur,CN=Users,DC=workshop,DC=local', 'Epsi2022!', (err) => {
    if (err) {
        console.error('Erreur lors de la connexion LDAP:', err);
    } else {
        console.log('Connexion LDAP réussie');
    }
});

// Fonction pour récupérer les membres d'un groupe via LDAP
async function getLdapGroupMembers(groupName) {
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

            const members = [];

            res.on('searchEntry', (entry) => {
                console.log('Entrée trouvée :', entry.object);
                const memberDNs = entry.object.member; // Récupérer les DN des membres
                if (Array.isArray(memberDNs)) {
                    members.push(...memberDNs);
                } else {
                    members.push(memberDNs);
                }
            });

            res.on('end', (result) => {
                console.log('Recherche terminée:', result);
                console.log('Membres trouvés:', members);
                resolve(members);
            });

            res.on('error', (error) => {
                console.error('Erreur lors de la recherche:', error);
                reject(error);
            });
        });
    });
}

module.exports = { getLdapGroupMembers };
