# Shopify Setup Guide

## Step 1: Get Your Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Click "Create API Key"
3. Copy your API key
4. Create a `.env` file in the Shopify folder:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Step 2: Run the Application

```bash
npm start
```

This launches the Electron app with the shopping assistant interface.

## Project Structure

```
Shopify/
├── main.js                 # Electron main process
├── src/
│   ├── index.html         # UI interface
│   ├── styles.css         # Styling
│   ├── app.js             # Frontend logic
│   ├── linkFinder.js      # AI & search logic
│   └── preload.js         # IPC bridge
├── package.json           # Dependencies
└── .env                   # API keys (KEEP SECRET!)
```

## How It Works

1. **User Query** → Text input in the UI
2. **AI Parsing** → Gemini understands what user wants
3. **Product Search** → Searches multiple retailers
4. **Analysis** → Finds best deal by price/quality/value
5. **Display** → Shows results with best deal highlighted

## Next Steps

- [ ] Add real web scraping with Puppeteer
- [ ] Integrate Google Shopping API for real results
- [ ] Add Amazon/eBay API integration
- [ ] Implement caching
- [ ] Add user preferences
- [ ] Create favorites/wishlist

## Environment Variables

Only `GEMINI_API_KEY` is required for basic functionality.

## Troubleshooting

- **No results**: Check your Gemini API key in `.env`
- **Electron won't start**: Run `npm install` again
- **API errors**: Verify your API key has quota available
