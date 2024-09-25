const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    buffer: { type: Buffer, required: true },
    uploadedBy: { type: String, required: true }, // Nom d'utilisateur
    uploadedByGroup: { type: [String], required: true }, // Groupes de l'utilisateur
    uploadedByOU: { type: String, required: true }
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);

module.exports = File;
