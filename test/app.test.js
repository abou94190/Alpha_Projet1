const request = require('supertest');
const app = require('../app'); // Assurez-vous que le chemin vers votre app est correct

describe('Test des routes de l\'application', () => {

    // Test de la route d'authentification
    describe('GET /', () => {
        it('devrait retourner le statut 200 et rendre la page d\'accueil', async () => {
            const res = await request(app).get('/');
            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain('Bienvenue sur EduShare !'); // Remplacez par le texte attendu
        });
    });

    // Test de la route de connexion
    describe('POST /login', () => {
        it('devrait se connecter avec des identifiants valides', async () => {
            const res = await request(app)
                .post('/login')
                .send({ username: 'demo', password: 'demo_password' }); // Remplacez par les identifiants de test
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('message', 'Connexion réussie'); // Remplacez par votre message
        });

        it('devrait retourner une erreur avec des identifiants invalides', async () => {
            const res = await request(app)
                .post('/login')
                .send({ username: 'invalid', password: 'invalid_password' });
            expect(res.statusCode).toEqual(401); // Erreur non autorisée
            expect(res.body).toHaveProperty('message', 'Identifiants invalides'); // Remplacez par votre message
        });
    });

    // Test de la route pour récupérer les fichiers
    describe('GET /files', () => {
        it('devrait retourner une liste de fichiers', async () => {
            const res = await request(app).get('/files');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('files'); // Vérifie que la réponse contient des fichiers
        });
    });

    // Test de la route de téléchargement de fichier
    describe('POST /files/upload', () => {
        it('devrait télécharger un fichier avec succès', async () => {
            const res = await request(app)
                .post('/files/upload')
                .attach('projectFile', 'tests/testfile.txt'); // Remplacez par le chemin vers un fichier de test
            expect(res.statusCode).toEqual(201); // Vérifie que la réponse est un succès
            expect(res.body).toHaveProperty('message', 'Fichier téléchargé avec succès'); // Remplacez par votre message de succès
        });
    });

    // Test de la route de suppression de fichier
    describe('DELETE /files/:filename', () => {
        it('devrait supprimer un fichier avec succès', async () => {
            const res = await request(app).delete('/files/testfile.txt'); // Remplacez par un fichier existant
            expect(res.statusCode).toEqual(200); // Vérifie que le fichier a été supprimé avec succès
            expect(res.body).toHaveProperty('message', 'Fichier supprimé avec succès'); // Remplacez par votre message de succès
        });
    });
});
