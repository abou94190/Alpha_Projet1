const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    deadline: { type: Date, required: true },
    createdBy: { type: String, required: true },
    assignedOU: { type: String, required: true },
    submissions: [{
        studentName: String,
        fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
        submittedAt: Date
    }]
});

module.exports = mongoose.model('Project', projectSchema);