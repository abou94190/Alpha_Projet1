// middleware/authMiddleware.js
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // L'utilisateur est authentifié, passe à la suite
    }
    res.redirect('/login'); // Redirige vers la page de login
}

module.exports = isAuthenticated;
// isProfMiddleware.js
// function isProf(req, res, next) {
//     // Vérifiez si l'utilisateur est authentifié
//     if (req.isAuthenticated()) {
//         // Vérifiez si l'utilisateur a le rôle de professeur
//         if (req.user.memberOf && req.user.memberOf.includes('Prof')) {
//             return next(); // Autoriser l'accès
//         }
//         // Rediriger ou renvoyer une erreur si l'utilisateur n'est pas professeur
//         return res.status(403).send('Accès interdit : vous n\'avez pas les autorisations nécessaires.');
//     }
//     // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
//     res.redirect('/login');
// }

// module.exports = isProf;
