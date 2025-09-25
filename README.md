# AI Image Placeholder Generator

A service similar to placehold.co but powered by AI image generation using the Nanobanana API. Generate placeholder images dynamically using text prompts.

## Features

- 🎨 AI-powered image generation using text prompts
- 📐 Customizable dimensions (1x1 to 4096x4096)
- ⚡ Image caching for improved performance
- 🔗 Simple URL-based API
- 💻 Beautiful web interface for testing
- 🚀 Easy deployment

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

> **Note**: Make sure to set the FAL_KEY environment variable in your deployment platform!

### 2. Set up API Key

Get your API key from [Nanobanana](https://www.nano-banana.ai) and set it as an environment variable:

```bash
# Windows
set NANOBANANA_API_KEY=your-api-key-here

# Linux/Mac
export NANOBANANA_API_KEY=your-api-key-here
```

Or create a `.env` file:
```
NANOBANANA_API_KEY=your-api-key-here
```

### 3. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## Usage

### URL Format

```
http://localhost:3000/{width}x{height}?text={prompt}
```

### Examples

- `http://localhost:3000/600x400?text=Hello+World`
- `http://localhost:3000/800x600?text=a%20beautiful%20sunset`
- `http://localhost:3000/400x400?text=cute%20cat%20in%20a%20garden`

### Parameters

- **width** × **height**: Image dimensions (e.g., 600x400)
- **text**: The prompt for AI image generation (URL encoded)

### Web Interface

Visit `http://localhost:3000` to use the interactive web interface where you can:
- Enter custom prompts
- Set dimensions
- Generate and preview images
- Copy direct URLs

## API Endpoints

### Generate Image
```
GET /{width}x{height}?text={prompt}
```

**Response**: JPEG image

**Headers**:
- `Content-Type: image/jpeg`
- `Cache-Control: public, max-age=86400`

### Health Check
```
GET /health
```

**Response**:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Configuration

### Environment Variables

- `NANOBANANA_API_KEY`: Your Nanobanana API key (required)
- `PORT`: Server port (default: 3000)

### Image Generation Settings

The service uses the following default settings:
- Model: `stable-diffusion-xl`
- Format: JPEG with 90% quality
- Cache TTL: 24 hours
- Timeout: 30 seconds for generation, 10 seconds for download

## Caching

Images are cached in memory for 24 hours to improve performance and reduce API calls. The cache key is based on dimensions and prompt text.

## Error Handling

- Invalid dimensions format returns 400 error
- Dimensions outside 1x1 to 4096x4096 range returns 400 error
- API failures fall back to SVG placeholder
- Network timeouts are handled gracefully

## Deployment

### Heroku

1. Create a Heroku app
2. Set environment variable: `heroku config:set NANOBANANA_API_KEY=your-key`
3. Deploy: `git push heroku main`

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel/Netlify

The service can be deployed to serverless platforms. Make sure to set the `NANOBANANA_API_KEY` environment variable.

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Check the [Nanobanana API documentation](https://www.nano-banana.ai)
- Open an issue in this repository
- Contact the maintainers
