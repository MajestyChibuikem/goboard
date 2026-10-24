import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

async function processImage(filename, maxWidth = 1400, quality = 82) {
  const filePath = path.join(publicDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing: ${filename}`);
    return;
  }

  const baseName = path.parse(filename).name;
  const webpPath = path.join(publicDir, `${baseName}.webp`);
  const initialStat = fs.statSync(filePath);

  console.log(`Processing ${filename} (${(initialStat.size / 1024).toFixed(1)} KB)...`);

  const image = sharp(filePath);
  const metadata = await image.metadata();

  // Resize if wider than maxWidth
  let pipeline = sharp(filePath);
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  // Generate WebP
  await pipeline
    .clone()
    .webp({ quality, effort: 6 })
    .toFile(webpPath);

  const webpStat = fs.statSync(webpPath);
  console.log(`  -> Generated ${baseName}.webp: ${(webpStat.size / 1024).toFixed(1)} KB (saved ${(((initialStat.size - webpStat.size) / initialStat.size) * 100).toFixed(1)}%)`);

  // Also compress original PNG/JPG in place to save fallback bandwidth
  if (filename.endsWith('.png')) {
    const tempCompressed = path.join(publicDir, `temp-${filename}`);
    await sharp(filePath)
      .resize({ width: Math.min(metadata.width || maxWidth, maxWidth), withoutEnlargement: true })
      .png({ compressionLevel: 9, quality: 85 })
      .toFile(tempCompressed);

    const tempStat = fs.statSync(tempCompressed);
    if (tempStat.size < initialStat.size) {
      fs.renameSync(tempCompressed, filePath);
      console.log(`  -> Compressed fallback ${filename}: ${(tempStat.size / 1024).toFixed(1)} KB`);
    } else {
      fs.unlinkSync(tempCompressed);
    }
  }
}

async function run() {
  await processImage('discover.png', 1400);
  await processImage('sign-in-google.png', 1400);
  await processImage('leave-updates.png', 1200);
  await processImage('submit-project.png', 1400);
  await processImage('logo-black.png', 256);
  await processImage('2nd.png', 1200);
  await processImage('3rd.png', 1200);
  await processImage('4th.png', 1200);
  await processImage('5th.png', 1200);
  await processImage('1st.jpg', 1200);
}

run().catch(console.error);
