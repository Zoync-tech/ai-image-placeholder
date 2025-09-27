const axios = require('axios');

// Test the server endpoints
async function testServer() {
    const baseUrl = 'https://vrccim.com';
    
    console.log('🧪 Testing AI Image Placeholder Server...\n');
    
    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${baseUrl}/health`);
        console.log('✅ Health check:', healthResponse.data);
        
        // Test image generation (this will use fallback SVG since no API key is set)
        console.log('\n2. Testing image generation endpoint...');
        const imageResponse = await axios.get(`${baseUrl}/600x400?text=Hello+World`, {
            responseType: 'arraybuffer'
        });
        console.log('✅ Image generated successfully');
        console.log('   Content-Type:', imageResponse.headers['content-type']);
        console.log('   Content-Length:', imageResponse.data.length, 'bytes');
        
        // Test invalid dimensions
        console.log('\n3. Testing invalid dimensions...');
        try {
            await axios.get(`${baseUrl}/invalid`);
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Invalid dimensions properly rejected');
            } else {
                throw error;
            }
        }
        
        // Test dimensions out of range
        console.log('\n4. Testing dimensions out of range...');
        try {
            await axios.get(`${baseUrl}/5000x5000?text=test`);
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Large dimensions properly rejected');
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 All tests passed! Server is working correctly.');
        console.log('\n📝 Note: To test with real AI images, set your NANOBANANA_API_KEY environment variable.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running: npm start');
        }
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testServer();
}

module.exports = testServer;
