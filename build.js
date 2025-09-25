const fs = require('fs');
const path = require('path');

console.log('🏗️  Building static site for GitHub Pages...\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy and modify the HTML file for static hosting
const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

// Replace localhost URLs with GitHub Pages URL
const modifiedHtml = htmlContent
  .replace(/http:\/\/localhost:3000/g, 'https://yourusername.github.io/ai-image-placeholder')
  .replace(/window\.location\.origin/g, "'https://yourusername.github.io/ai-image-placeholder'");

// Add GitHub Pages specific configuration
const githubPagesHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Image Placeholder Generator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 300;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .content {
            padding: 40px;
        }

        .generator-section {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }

        input, textarea {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
        }

        .dimensions-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .generate-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
            width: 100%;
        }

        .generate-btn:hover {
            transform: translateY(-2px);
        }

        .generate-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .result-section {
            margin-top: 30px;
        }

        .image-container {
            background: white;
            border: 2px dashed #e1e5e9;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .generated-image {
            max-width: 100%;
            max-height: 500px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .placeholder-text {
            color: #666;
            font-size: 1.1rem;
        }

        .url-section {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }

        .url-input {
            background: white;
            border: 2px solid #e1e5e9;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            word-break: break-all;
        }

        .copy-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin-left: 10px;
            font-weight: 600;
        }

        .copy-btn:hover {
            background: #218838;
        }

        .examples {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }

        .examples h3 {
            margin-bottom: 20px;
            color: #333;
        }

        .example-link {
            display: inline-block;
            background: white;
            color: #667eea;
            text-decoration: none;
            padding: 10px 15px;
            border-radius: 6px;
            margin: 5px;
            border: 1px solid #e1e5e9;
            transition: all 0.3s ease;
        }

        .example-link:hover {
            background: #667eea;
            color: white;
            transform: translateY(-2px);
        }

        .loading {
            display: none;
            color: #667eea;
            font-weight: 600;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .error {
            color: #dc3545;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
            display: none;
        }

        .note {
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .note h4 {
            color: #0066cc;
            margin-bottom: 10px;
        }

        .note p {
            color: #333;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 AI Image Placeholder</h1>
            <p>Generate AI-powered placeholder images using text prompts</p>
        </div>

        <div class="content">
            <div class="note">
                <h4>🚀 GitHub Pages Demo</h4>
                <p>This is a static demo version. For full functionality with AI image generation, you'll need to:</p>
                <p>1. Set up your own server with the FAL AI API key</p>
                <p>2. Deploy the backend to a service like Heroku, Vercel, or Railway</p>
                <p>3. Update the API URL in this frontend</p>
            </div>

            <div class="generator-section">
                <h2>Generate New Image</h2>
                <form id="imageForm">
                    <div class="form-group">
                        <label for="prompt">Image Prompt</label>
                        <textarea id="prompt" placeholder="Describe the image you want to generate... (e.g., 'a beautiful sunset over mountains', 'abstract art with vibrant colors')" rows="3"></textarea>
                    </div>
                    
                    <div class="dimensions-row">
                        <div class="form-group">
                            <label for="width">Width</label>
                            <input type="number" id="width" value="600" min="1" max="4096">
                        </div>
                        <div class="form-group">
                            <label for="height">Height</label>
                            <input type="number" id="height" value="400" min="1" max="4096">
                        </div>
                    </div>

                    <button type="submit" class="generate-btn">
                        <span class="btn-text">Generate Image</span>
                        <div class="loading">
                            <div class="spinner"></div>
                            Generating AI image...
                        </div>
                    </button>
                </form>

                <div class="error" id="errorMessage"></div>
            </div>

            <div class="result-section">
                <h3>Generated Image</h3>
                <div class="image-container" id="imageContainer">
                    <div class="placeholder-text">
                        Enter a prompt and click "Generate Image" to create your AI placeholder
                    </div>
                </div>
            </div>

            <div class="url-section">
                <h3>Direct URL</h3>
                <p>Use this URL format to generate images directly:</p>
                <input type="text" class="url-input" id="urlInput" readonly placeholder="URL will appear here...">
                <button class="copy-btn" onclick="copyUrl()">Copy URL</button>
            </div>

            <div class="examples">
                <h3>Example URLs</h3>
                <p>Try these example prompts:</p>
                <a href="/600x400?text=a%20beautiful%20sunset" class="example-link">Sunset (600x400)</a>
                <a href="/800x600?text=abstract%20art%20with%20vibrant%20colors" class="example-link">Abstract Art (800x600)</a>
                <a href="/400x400?text=cute%20cat%20in%20a%20garden" class="example-link">Cute Cat (400x400)</a>
                <a href="/1200x800?text=modern%20cityscape%20at%20night" class="example-link">Cityscape (1200x800)</a>
                <a href="/300x200?text=minimalist%20design" class="example-link">Minimalist (300x200)</a>
            </div>
        </div>
    </div>

    <script>
        // Get the GitHub Pages base URL
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
        
        const form = document.getElementById('imageForm');
        const promptInput = document.getElementById('prompt');
        const widthInput = document.getElementById('width');
        const heightInput = document.getElementById('height');
        const imageContainer = document.getElementById('imageContainer');
        const urlInput = document.getElementById('urlInput');
        const errorMessage = document.getElementById('errorMessage');
        const generateBtn = document.querySelector('.generate-btn');
        const btnText = document.querySelector('.btn-text');
        const loading = document.querySelector('.loading');

        // Update URL when inputs change
        function updateUrl() {
            const prompt = encodeURIComponent(promptInput.value || 'abstract art');
            const width = widthInput.value;
            const height = heightInput.value;
            urlInput.value = baseUrl + '/' + width + 'x' + height + '?text=' + prompt;
        }

        promptInput.addEventListener('input', updateUrl);
        widthInput.addEventListener('input', updateUrl);
        heightInput.addEventListener('input', updateUrl);

        // Initial URL update
        updateUrl();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const prompt = promptInput.value || 'abstract art';
            const width = widthInput.value;
            const height = heightInput.value;

            // Show loading state
            generateBtn.disabled = true;
            btnText.style.display = 'none';
            loading.style.display = 'block';
            errorMessage.style.display = 'none';

            try {
                const url = '/' + width + 'x' + height + '?text=' + encodeURIComponent(prompt);
                
                // Create image element
                const img = new Image();
                img.className = 'generated-image';
                
                img.onload = function() {
                    imageContainer.innerHTML = '';
                    imageContainer.appendChild(img);
                    
                    // Update URL input
                    urlInput.value = baseUrl + url;
                    
                    // Hide loading
                    generateBtn.disabled = false;
                    btnText.style.display = 'block';
                    loading.style.display = 'none';
                };

                img.onerror = function() {
                    throw new Error('Failed to load image');
                };

                img.src = url;

            } catch (error) {
                console.error('Error:', error);
                errorMessage.textContent = 'Failed to generate image. Please try again.';
                errorMessage.style.display = 'block';
                
                // Hide loading
                generateBtn.disabled = false;
                btnText.style.display = 'block';
                loading.style.display = 'none';
            }
        });

        function copyUrl() {
            urlInput.select();
            urlInput.setSelectionRange(0, 99999); // For mobile devices
            
            try {
                document.execCommand('copy');
                const copyBtn = document.querySelector('.copy-btn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = '#28a745';
                
                setTimeout(function() {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = '#28a745';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy URL:', err);
            }
        }

        // Load example from URL parameters if present
        const urlParams = new URLSearchParams(window.location.search);
        const textParam = urlParams.get('text');
        const dimensionsMatch = window.location.pathname.match(/\/(\d+)x(\d+)/);
        
        if (textParam || dimensionsMatch) {
            if (textParam) {
                promptInput.value = decodeURIComponent(textParam);
            }
            if (dimensionsMatch) {
                widthInput.value = dimensionsMatch[1];
                heightInput.value = dimensionsMatch[2];
            }
            updateUrl();
            form.dispatchEvent(new Event('submit'));
        }
    </script>
</body>
</html>
`;

// Write the modified HTML file
fs.writeFileSync(path.join(distDir, 'index.html'), githubPagesHtml);

// Copy other static assets if they exist
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  files.forEach(file => {
    if (file !== 'index.html') {
      fs.copyFileSync(
        path.join(publicDir, file),
        path.join(distDir, file)
      );
    }
  });
}

console.log('✅ Static site built successfully!');
console.log('📁 Files created in ./dist directory');
console.log('🚀 Ready for GitHub Pages deployment');
console.log('\n📋 Next steps:');
console.log('1. Push this repository to GitHub');
console.log('2. Enable GitHub Pages in repository settings');
console.log('3. Select "Deploy from a branch" and choose "gh-pages"');
console.log('4. Your site will be available at: https://yourusername.github.io/ai-image-placeholder');
