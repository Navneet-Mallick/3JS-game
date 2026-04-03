// Simple icon generator script
const fs = require('fs');

// Create a simple 1x1 pixel PNG as placeholder (will be replaced by real icons)
const createPlaceholderPNG = (size) => {
    // Create a simple green square as placeholder
    const canvas = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#0a0a0a"/>
      <rect x="${size*0.05}" y="${size*0.05}" width="${size*0.9}" height="${size*0.9}" rx="${size*0.1}" fill="#1a1a2e" stroke="#00ff00" stroke-width="${size*0.01}"/>
      <text x="${size*0.5}" y="${size*0.3}" font-family="Arial, sans-serif" font-size="${size*0.125}" font-weight="bold" fill="#00ff00" text-anchor="middle">NEO-NOIR</text>
      <text x="${size*0.5}" y="${size*0.45}" font-family="Arial, sans-serif" font-size="${size*0.09}" fill="#ffffff" text-anchor="middle">CITY</text>
      <circle cx="${size*0.26}" cy="${size*0.65}" r="${size*0.08}" fill="#00ff00" opacity="0.8"/>
      <circle cx="${size*0.5}" cy="${size*0.65}" r="${size*0.08}" fill="#00ff00" opacity="0.8"/>
      <circle cx="${size*0.74}" cy="${size*0.65}" r="${size*0.08}" fill="#00ff00" opacity="0.8"/>
      <rect x="${size*0.2}" y="${size*0.75}" width="${size*0.6}" height="${size*0.1}" rx="${size*0.02}" fill="#00ff00" opacity="0.3"/>
    </svg>
    `;
    
    // Write SVG file
    fs.writeFileSync(`icon-${size}.svg`, canvas);
    console.log(`Created icon-${size}.svg`);
};

// Generate icons
[192, 512, 1024].forEach(size => createPlaceholderPNG(size));
