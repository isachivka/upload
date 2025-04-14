# File Transfer App

A simple web application for transferring files from your phone to your MacBook.

## Features

- Upload multiple files simultaneously
- Progress tracking per file
- Support for large files (up to 50GB)
- Files are automatically saved to your Downloads folder
- Responsive design that works on mobile devices

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

## Project Structure

- `pages/` - Contains the main page and API endpoint
- `styles/` - Contains the CSS styles
- `public/` - Static assets

## Learn More

To learn more about Next.js, visit [Next.js Documentation](https://nextjs.org/docs).
