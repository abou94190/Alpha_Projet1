const request = require('supertest');
const app = require('../app'); // Chemin vers votre fichier principal de l'application

describe('API Routes', () => {
    // Test de la route GET /files
    describe('GET /files', () => {
        it('should return a list of files', async () => {
            const res = await request(app).get('/files');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('files'); // Vérifie que la réponse contient des fichiers
        });
    });

    // Test de la route POST /files/upload
    describe('POST /files/upload', () => {
        it('should upload a file successfully', async () => {
            const res = await request(app)
                .post('/files/upload')
                .attach('projectFile', 'tests/test-file.txt'); // Remplacez par le chemin vers un fichier de test dans le dossier tests
            expect(res.statusCode).toEqual(201); // Vérifie que la réponse est un succès (status 201)
            expect(res.body).toHaveProperty('message', 'File uploaded successfully'); // Adapté à votre message de succès
        });
    });

    // Test de la route DELETE /files/:filename
    describe('DELETE /files/:filename', () => {
        it('should delete a file successfully', async () => {
            const res = await request(app).delete('/files/testfile.txt'); // Remplacez par un fichier existant
            expect(res.statusCode).toEqual(200); // Vérifie que le fichier a été supprimé avec succès
            expect(res.body).toHaveProperty('message', 'File deleted successfully'); // Adapté à votre message de succès
        });
    });

    // Autres tests pour d'autres routes peuvent être ajoutés ici
});
