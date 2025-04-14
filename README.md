# File Transfer App

A simple web application for transferring files from my phone to my MacBook.

Vibe coded in 15 minutes using Cursor & Claude 3.7

## Features

- Upload multiple files simultaneously
- Progress tracking per file with upload speed and estimated time remaining
- Support for large files (up to 50GB)
- Files are automatically saved to your Downloads folder
- Background uploads through Web Workers (continues even when switching apps)
- Auto-retry mechanism for failed uploads (up to 3 retries with exponential backoff)
- Screen stays active during file uploads (using Wake Lock API)
- Responsive design that works well on mobile devices
- Detailed error reporting

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn
# or
pnpm install
# or
bun install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How to Use

1. Make sure your phone and MacBook are on the same network
2. Run the app on your MacBook using the instructions above
3. Find your MacBook's IP address (System Preferences → Network)
4. On your phone, open a browser and navigate to `http://YOUR_MACBOOK_IP:3000`
5. Select files to upload and click "Upload Files"
6. Your files will be saved to the Downloads folder on your MacBook

## Advanced Features

### Background Uploads
The app uses Web Workers to perform uploads in a background thread. This means uploads will continue even when you switch to another app on your phone.

### Screen Wake Lock
When an upload is in progress, the app prevents your phone's screen from turning off, similar to when watching a video.

### Auto-Retry Mechanism
If an upload fails due to network issues or timeouts, the app will automatically retry up to 3 times with increasing delays between attempts.

## Browser Compatibility

- **Web Workers**: Supported in all modern browsers
- **Wake Lock API**: Supported in Chrome, Edge, and other Chromium-based browsers. Not supported in Safari or Firefox.

## Project Structure

- `pages/` - Contains the main page and API endpoint
- `styles/` - Contains the CSS styles
- `public/` - Static assets and Web Worker implementation

## Learn More

To learn more about Next.js, visit [Next.js Documentation](https://nextjs.org/docs).
