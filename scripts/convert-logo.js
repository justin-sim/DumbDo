const sharp = require('sharp');
const path = require('path');

// Sizes for different use cases
const sizes = [16, 32, 48, 64, 128, 256];

async function convertToPng() {
    const inputFile = path.join(__dirname, '..', 'favicon.svg');
    
    for (const size of sizes) {
        await sharp(inputFile)
            .resize(size, size)
            .png()
            .toFile(path.join(__dirname, '..', 'assets', `logo-${size}.png`));
        
        console.log(`Created ${size}x${size} PNG`);
    }
    
    // Create favicon.ico size
    await sharp(inputFile)
        .resize(32, 32)
        .png()
        .toFile(path.join(__dirname, '..', 'assets', 'favicon.png'));
    
    console.log('Conversion complete!');
}

// Create assets directory if it doesn't exist
const fs = require('fs');
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

convertToPng().catch(console.error); 