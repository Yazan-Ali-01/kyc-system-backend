const fs = require('fs');
const path = require('path');

// Function to generate the folder structure
function generateFolderStructure(dir, result = '', depth = 0) {
  // Get all files and folders in the current directory
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    // Exclude .git and node_modules folders
    if (file !== '.git' && file !== 'node_modules') {
      const indent = ' '.repeat(depth * 2); // Add indentation based on depth
      result += `${indent}${file}\n`; // Add the file/folder name to the result

      // If it's a directory, recursively explore it
      if (stats.isDirectory()) {
        result = generateFolderStructure(filePath, result, depth + 1);
      }
    }
  });

  return result;
}

// Main function to start the process
function createFolderStructureFile() {
  const rootDir = process.cwd(); // Start from the current working directory
  const folderStructure = generateFolderStructure(rootDir);

  // Write the folder structure to a text file
  fs.writeFileSync('folder_structure.txt', folderStructure, 'utf-8');
  console.log('Folder structure has been written to folder_structure.txt');
}

// Run the main function
createFolderStructureFile();
