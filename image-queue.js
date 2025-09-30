// JavaScript-only queuing system (bypasses database functions)
class InMemoryQueue {
  constructor() {
    this.generations = new Map(); // prompt_hash -> generation data
    this.cache = new Map(); // prompt_hash -> cached URL
  }
  
  generateHash(prompt, dimensions, format) {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
      .update(`${prompt}|${dimensions}|${format}`)
      .digest('hex');
  }
  
  getCachedImage(prompt, dimensions, format) {
    const hash = this.generateHash(prompt, dimensions, format);
    return this.cache.get(hash) || null;
  }
  
  storeCachedImage(prompt, dimensions, format, url) {
    const hash = this.generateHash(prompt, dimensions, format);
    this.cache.set(hash, url);
  }
  
  getOrCreateGenerationStatus(prompt, dimensions, format) {
    const hash = this.generateHash(prompt, dimensions, format);
    
    if (!this.generations.has(hash)) {
      this.generations.set(hash, {
        id: hash,
        status: 'pending',
        generatedUrl: null,
        totalRequests: 1,
        createdAt: new Date()
      });
    } else {
      const existing = this.generations.get(hash);
      existing.totalRequests++;
      this.generations.set(hash, existing);
    }
    
    return this.generations.get(hash);
  }
  
  updateGenerationStatus(hash, status, generatedUrl = null) {
    if (this.generations.has(hash)) {
      const existing = this.generations.get(hash);
      existing.status = status;
      existing.generatedUrl = generatedUrl;
      this.generations.set(hash, existing);
      
      // Store in cache when completed
      if (status === 'completed' && generatedUrl) {
        this.cache.set(hash, generatedUrl);
      }
    }
  }
  
  getGenerationStatusById(hash) {
    return this.generations.get(hash) || null;
  }
  
  clearCache() {
    this.cache.clear();
    this.generations.clear();
    console.log('🧹 Cache cleared');
  }
}

// Create global queue instance
const imageQueue = new InMemoryQueue();

// Export for use in server
module.exports = imageQueue;
