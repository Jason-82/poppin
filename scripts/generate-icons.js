const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple purple circle icon with "P" letter
const createIcon = async (size) => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#9f7aea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad)"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.6}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central">P</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(iconsDir, `icon-${size}.png`));

  console.log(`Created icon-${size}.png`);
};

// Generate both icon sizes
Promise.all([
  createIcon(192),
  createIcon(512)
]).then(() => {
  console.log('All icons generated successfully!');
}).catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
