const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  user: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  type: { type: String, enum: ['file', 'resource'], required: true }
});

module.exports = mongoose.model('File', fileSchema);