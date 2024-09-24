// db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/mon_atelier', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("MongoDB connecté");
    } catch (error) {
        console.error("Erreur de connexion à MongoDB:", error);
        process.exit(1);
    }
};

module.exports = connectDB;
