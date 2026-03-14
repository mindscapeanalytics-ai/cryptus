const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../public/images');
const files = fs.readdirSync(imagesDir);

files.forEach(file => {
  if (file.endsWith('.png')) {
    const inputPath = path.join(imagesDir, file);
    const outputPath = path.join(imagesDir, file.replace('.png', '.webp'));
    
    console.log(`Converting ${file} to WebP...`);
    sharp(inputPath)
      .webp({ quality: 85 })
      .toFile(outputPath)
      .then(() => {
        console.log(`Successfully created ${outputPath}`);
      })
      .catch(err => {
        console.error(`Error converting ${file}:`, err);
      });
  }
});
