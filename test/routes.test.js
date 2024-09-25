const request = require('supertest');
const http = require('http');
const app = require('../app');  // Importez l'application

let server;  // On va stocker l'instance du serveur ici

// Démarrez le serveur avant les tests
beforeAll((done) => {
    server = http.createServer(app);
    server.listen(done);  // Le serveur écoute et on appelle done pour indiquer que l'initialisation est terminée
});

// Fermez le serveur après tous les tests
afterAll((done) => {
    server.close(done);
});

describe('API Routes', () => {
    describe('GET /files', () => {
        it('should return a list of files', async () => {
            const res = await request(server).get('/files');  // Utilisez le serveur pour les requêtes
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('files');  // Assurez-vous que l'API renvoie bien les fichiers
        });
    });

    describe('POST /files/upload', () => {
        it('should upload a file successfully', async () => {
            const res = await request(server)
                .post('/files/upload')
                .attach('projectFile', 'tests/test-file.txt');  // Remplacez par un fichier de test valide
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'File uploaded successfully');
        });
    });

    describe('DELETE /files/:filename', () => {
        it('should delete a file successfully', async () => {
            const res = await request(server).delete('/files/testfile.txt');
            expect(res.statusCode).toEqual(200);  // Vérifiez que la suppression a été un succès
            expect(res.body).toHaveProperty('message', 'File deleted successfully');
        });
    });
});
