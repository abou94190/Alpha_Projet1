const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    uploadedBy: { type: String, required: true }, // sAMAccountName de l'utilisateur
    uploadedByGroup: { type: String, required: true }, // Groupe de l'utilisateur
    buffer: { type: Buffer, required: true }, // Champ buffer requis
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
