const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    studentName: String,
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    submittedAt: Date,
    grade: Number,
    feedback: String
});

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    deadline: { type: Date, required: true },
    createdBy: { type: String, required: true },
    assignedOU: { type: String, required: true },
    submissions: [submissionSchema]
});

module.exports = mongoose.model('Project', projectSchema);