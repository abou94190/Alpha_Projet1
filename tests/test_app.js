// Supposons que vous ayez une fonction à tester dans app.js
const app = require('../app'); // Si vous avez une fonction exportée dans app.js

test('Devrait renvoyer un message de bienvenue', () => {
  const message = app.getWelcomeMessage();  // Imaginons que cette fonction existe
  expect(message).toBe('Bienvenue sur EduShare !');
});
