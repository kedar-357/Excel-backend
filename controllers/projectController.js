const Project = require('../models/Project');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Folder = require('../models/Folder');

// Helper: Convert 2D array to array of objects using headers
function arrayToObjects(data) {
  if (!data || data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { projectName, chartType, xAxis, yAxis, bubbleSize } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'Excel file is required' });
    }

    // Parse Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const cleanData = jsonData.filter(row => row.some(cell => cell !== null && cell !== ''));
    const objectData = arrayToObjects(cleanData);

    // Store only the relevant columns for charting
    let chartData;
    if (chartType === 'bubble' && bubbleSize) {
      chartData = objectData.map(row => ({
        [xAxis]: row[xAxis],
        [yAxis]: row[yAxis],
        [bubbleSize]: row[bubbleSize],
      }));
    } else {
      chartData = objectData.map(row => ({
        [xAxis]: row[xAxis],
        [yAxis]: row[yAxis],
      }));
    }

    // Store preview data (first 5 rows) in database
    const previewData = objectData.slice(0, 5);

    // Create project
    const project = new Project({
      userId,
      projectName,
      chartType,
      filePath: req.file.path,
      originalFileName: req.file.originalname,
      data: chartData,
      previewData: previewData,
      chartConfig: Object.assign(
        { xAxis, yAxis },
        (chartType === 'bubble' && bubbleSize) ? { bubbleSize } : {}
      )
    });

    await project.save();

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: project._id,
        projectName: project.projectName,
        chartType: project.chartType,
        originalFileName: project.originalFileName,
        createdAt: project.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'An unexpected error occurred while creating the project. Please try again later or contact support.', error: error.message });
  }
};

// Get all projects for the logged-in user
exports.getUserProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const projects = await Project.find({ userId })
      .select('projectName chartType originalFileName createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Unable to fetch your projects at this time. Please try again later.', error: error.message });
  }
};

// Get a specific project by ID
exports.getProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findOne({ _id: projectId, userId });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Error fetching project' });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { projectName, chartType, chartConfig } = req.body;

    const project = await Project.findOne({ _id: projectId, userId });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (projectName) project.projectName = projectName;
    if (chartType) project.chartType = chartType;
    if (chartConfig) project.chartConfig = chartConfig;

    await project.save();

    res.json({
      message: 'Project updated successfully',
      project: {
        id: project._id,
        projectName: project.projectName,
        chartType: project.chartType,
        originalFileName: project.originalFileName,
        updatedAt: project.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Error updating project' });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findOne({ _id: projectId, userId });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Delete the file
    if (fs.existsSync(project.filePath)) {
      fs.unlinkSync(project.filePath);
    }

    await Project.findByIdAndDelete(projectId);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Error deleting project' });
  }
}; 

// Get first 5 rows of the uploaded Excel file for a project (data preview)
exports.getProjectPreview = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Return preview data from database instead of reading from ephemeral disk
    res.json({ preview: project.previewData || [] });
  } catch (error) {
    console.error('Error fetching project preview:', error);
    res.status(500).json({ message: 'Error fetching project preview' });
  }
}; 

// Duplicate project
exports.duplicateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const original = await Project.findOne({ _id: projectId, userId });
    if (!original) return res.status(404).json({ message: 'Project not found' });

    // Copy the Excel file if it exists
    let newFilePath = '';
    let newOriginalFileName = '';
    if (original.filePath && fs.existsSync(original.filePath)) {
      const ext = path.extname(original.filePath);
      const base = path.basename(original.filePath, ext);
      const newFileName = `${base}-copy-${Date.now()}${ext}`;
      const uploadsDir = path.dirname(original.filePath);
      newFilePath = path.join(uploadsDir, newFileName);
      fs.copyFileSync(original.filePath, newFilePath);
      newOriginalFileName = `Copy of ${original.originalFileName}`;
    }

    const duplicate = new Project({
      userId,
      projectName: `${original.projectName} (Copy)`,
      chartType: original.chartType,
      filePath: newFilePath || original.filePath,
      originalFileName: newOriginalFileName || original.originalFileName,
      data: original.data,
      previewData: original.previewData,
      chartConfig: original.chartConfig
    });
    await duplicate.save();
    res.status(201).json({
      message: 'Project duplicated successfully',
      project: {
        id: duplicate._id,
        projectName: duplicate.projectName,
        chartType: duplicate.chartType,
        originalFileName: duplicate.originalFileName,
        createdAt: duplicate.createdAt
      }
    });
  } catch (error) {
    console.error('Error duplicating project:', error);
    res.status(500).json({ message: 'Error duplicating project' });
  }
}; 

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name is required' });
    const folder = new Folder({ userId, name });
    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Error creating folder' });
  }
};

// List all folders for the user
exports.getFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    const folders = await Folder.find({ userId }).sort({ createdAt: -1 });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching folders' });
  }
};

// List projects in a folder
exports.getProjectsInFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.params;
    const projects = await Project.find({ userId, folderId });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects in folder' });
  }
};

// Move a project to a folder
exports.moveProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { folderId } = req.body;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    project.folderId = folderId || null;
    await project.save();
    res.json({ message: 'Project moved successfully', project });
  } catch (error) {
    res.status(500).json({ message: 'Error moving project' });
  }
}; 
