// models/file.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    // Tu peux ajouter d'autres champs si nécessaire
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
