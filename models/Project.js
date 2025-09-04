const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  chartType: {
    type: String,
    required: true,
    enum: [
      'bar',
      'line', 
      'pie',
      'doughnut',
      'radar',
      'scatter',
      'bubble',
      'mixed',
      'polarArea'
    ]
  },
  filePath: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  previewData: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  chartConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  folderId: { type: String, default: null }
}, {
  timestamps: true
});

// Index for faster queries
projectSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema); 
