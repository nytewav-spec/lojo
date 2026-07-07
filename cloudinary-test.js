const cloudinary = require('cloudinary').v2;

// =====================================
// CONFIG
// =====================================

cloudinary.config({
    cloud_name: 'rtlbhsis',
    api_key: '785564953654681',
    api_secret: '0vAdIj9PQWk9SmwVtRGQ-4CSfLE'
});

// =====================================
// STEP 1: Upload an image
// =====================================

console.log('📤 Uploading image...');

cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', (error, result) => {
    if (error) {
        console.error('❌ Upload failed:', error);
        return;
    }

    console.log('✅ Upload complete!');
    console.log('📷 Secure URL:', result.secure_url);
    console.log('🆔 Public ID:', result.public_id);
    console.log('');

    // =====================================
    // STEP 2: Get image details
    // =====================================

    console.log('📊 Image Metadata:');
    console.log('   Width:  ' + result.width + 'px');
    console.log('   Height: ' + result.height + 'px');
    console.log('   Format: ' + result.format);
    console.log('   Size:   ' + result.bytes + ' bytes');
    console.log('');

    // =====================================
    // STEP 3: Generate transformed URL
    // =====================================

    // f_auto = automatically chooses the best format (WebP, AVIF, etc.)
    // q_auto = automatically chooses the best quality for file size
    const transformedUrl = cloudinary.url(result.public_id, {
        transformation: [
            { width: 800, height: 400, crop: 'limit' },
            { fetch_format: 'auto' },
            { quality: 'auto' }
        ]
    });

    console.log('🎨 Transformed URL (optimized):');
    console.log(transformedUrl);
    console.log('');
    console.log('✅ Done! Click the link above to see the optimized image.');
    console.log('   - f_auto: Automatically selects the best format');
    console.log('   - q_auto: Automatically selects optimal quality');
});
