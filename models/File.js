// models/Resource.js
const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    uploadedByOU: { type: String },
    uploadedByGroup: { type: [String] },
    notes: { type: Map, of: Number, default: {} }, // Initialiser avec un objet vide
});


module.exports = mongoose.model('Resource', resourceSchema);
