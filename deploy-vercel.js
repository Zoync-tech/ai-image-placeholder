const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Vercel Deployment Helper\n');

// Check if vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'pipe' });
  console.log('✅ Vercel CLI is installed');
} catch (error) {
  console.log('❌ Vercel CLI not found. Installing...');
  try {
    execSync('npm install -g vercel', { stdio: 'inherit' });
    console.log('✅ Vercel CLI installed successfully');
  } catch (installError) {
    console.log('❌ Failed to install Vercel CLI. Please install manually:');
    console.log('   npm install -g vercel');
    process.exit(1);
  }
}

// Check if vercel.json exists
if (!fs.existsSync(path.join(__dirname, 'vercel.json'))) {
  console.log('❌ vercel.json not found. Please ensure it exists.');
  process.exit(1);
}

console.log('✅ vercel.json configuration found');

// Check if .env or environment variables are set
const falKey = process.env.FAL_KEY || '789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32';
if (!falKey) {
  console.log('⚠️  FAL_KEY not set. You\'ll need to set it in Vercel dashboard after deployment.');
} else {
  console.log('✅ FAL_KEY is configured');
}

console.log('\n🚀 Ready to deploy to Vercel!');
console.log('\n📋 Deployment Options:');
console.log('1. 🖥️  Via Vercel Dashboard (Recommended):');
console.log('   • Push to GitHub: git push origin main');
console.log('   • Go to vercel.com/dashboard');
console.log('   • Import your repository');
console.log('   • Set FAL_KEY environment variable');
console.log('   • Deploy!');

console.log('\n2. 💻 Via CLI:');
console.log('   • Run: vercel login');
console.log('   • Run: vercel --prod');
console.log('   • Set environment variables when prompted');

console.log('\n3. 🔧 Quick CLI Deploy:');
console.log('   • Run: npm run vercel-deploy');

console.log('\n📝 After deployment:');
console.log('   • Your site will be live at: https://your-project-name.vercel.app');
console.log('   • Test with: https://your-project-name.vercel.app/600x400?text=Hello+World');
console.log('   • Monitor in Vercel dashboard');

console.log('\n🎨 Features you\'ll get:');
console.log('   ✅ Full AI image generation');
console.log('   ✅ Automatic HTTPS');
console.log('   ✅ Global CDN');
console.log('   ✅ Automatic deployments');
console.log('   ✅ Custom domains');
console.log('   ✅ Analytics');

console.log('\n💡 Need help? Check VERCEL_DEPLOYMENT.md for detailed instructions!');
