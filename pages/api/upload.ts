import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import type { Fields, Files, File } from 'formidable';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Disable default body parser to handle files
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024 * 1024, // 50GB
    });

    // Create download directory if it doesn't exist
    const downloadDir = '/Users/is/Downloads';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const formData = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.parse(req, (err: any, fields: Fields, files: Files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ fields, files });
      });
    });

    const fileArray = formData.files.file as unknown as File[];
    const file = fileArray[0];
    const filePath = file.filepath;
    const fileName = file.originalFilename || 'file';
    
    // Generate a unique filename if a file with the same name already exists
    let uniqueFileName = fileName;
    let counter = 1;
    
    while (fs.existsSync(path.join(downloadDir, uniqueFileName))) {
      const extname = path.extname(fileName);
      const basename = path.basename(fileName, extname);
      uniqueFileName = `${basename} (${counter})${extname}`;
      counter++;
    }
    
    const destinationPath = path.join(downloadDir, uniqueFileName);
    
    // Copy file to Downloads directory
    await promisify(fs.copyFile)(filePath, destinationPath);
    
    // Remove temporary file
    await promisify(fs.unlink)(filePath);
    
    res.status(200).json({ 
      message: 'File uploaded successfully',
      fileName: uniqueFileName
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Error processing upload' });
  }
} 