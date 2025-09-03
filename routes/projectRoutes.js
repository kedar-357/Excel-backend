const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createProject,
  getUserProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectPreview,
  duplicateProject,
  createFolder,
  getFolders,
  getProjectsInFolder,
  moveProject
} = require('../controllers/projectController');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only Excel files
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Project routes
router.post('/', upload.single('excelFile'), createProject);
router.get('/', getUserProjects);
router.get('/:projectId', getProject);
// Add preview route
router.get('/:projectId/preview', getProjectPreview);
// Update project details (rename, chart type, etc.)
router.put('/:projectId', updateProject);
router.delete('/:projectId', deleteProject);
router.post('/:projectId/duplicate', duplicateProject);
router.post('/folders', createFolder);
router.get('/folders', getFolders);
router.get('/folders/:folderId/projects', getProjectsInFolder);
router.put('/:projectId/move', moveProject);

module.exports = router; 