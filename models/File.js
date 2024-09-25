const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    buffer: { type: Buffer, required: true },
    uploadedBy: { type: String, required: true },
    uploadedByGroup: { type: [String], required: true },// Assurez-vous que cette propriété est bien ajoutée
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);

module.exports = File;
