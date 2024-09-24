// middleware/authMiddleware.js
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // L'utilisateur est authentifié, passe à la suite
    }
    res.redirect('/login'); // Redirige vers la page de login
}

module.exports = isAuthenticated;