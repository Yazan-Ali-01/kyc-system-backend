const fs = require('fs');
const path = require('path');


function generateFolderStructure(dir, result = '', depth = 0) {

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);


    if (file !== '.git' && file !== 'node_modules') {
      const indent = ' '.repeat(depth * 2);
      result += `${indent}${file}\n`;


      if (stats.isDirectory()) {
        result = generateFolderStructure(filePath, result, depth + 1);
      }
    }
  });

  return result;
}


function createFolderStructureFile() {
  const rootDir = process.cwd();
  const folderStructure = generateFolderStructure(rootDir);


  fs.writeFileSync('folder_structure.txt', folderStructure, 'utf-8');
  console.log('Folder structure has been written to folder_structure.txt');
}


createFolderStructureFile();
