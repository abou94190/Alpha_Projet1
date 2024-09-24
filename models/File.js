const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    buffer: { type: Buffer, required: true }, // Store file data as Buffer
    createdAt: { type: Date, default: Date.now },
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
