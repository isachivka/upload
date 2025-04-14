import Head from "next/head";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useState, useRef, ChangeEvent } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  id: string;
}

export default function Home() {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        progress: 0,
        status: 'pending' as const,
        id: generateUUID()
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  // Cross-platform UUID generation function
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const uploadFiles = async () => {
    for (const fileItem of files) {
      if (fileItem.status !== 'pending') continue;
      
      await uploadFile(fileItem);
    }
  };

  const uploadFile = async (fileItem: FileWithProgress) => {
    const formData = new FormData();
    formData.append('file', fileItem.file);

    try {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading' } : f
      ));

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, progress } : f
          ));
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open('POST', '/api/upload');
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setFiles(prev => prev.map(f => 
              f.id === fileItem.id ? { ...f, status: 'done', progress: 100 } : f
            ));
            resolve();
          } else {
            setFiles(prev => prev.map(f => 
              f.id === fileItem.id ? { ...f, status: 'error' } : f
            ));
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'error' } : f
          ));
          reject(new Error('Network error'));
        };
        
        xhr.send(formData);
      });
    } catch (error) {
      console.error(`Error uploading ${fileItem.file.name}:`, error);
    }
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'done'));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <>
      <Head>
        <title>File Transfer App</title>
        <meta name="description" content="Transfer files from phone to computer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}>
        <main className={styles.main}>
          <h1 className={styles.title}>Передача файлов</h1>
          <p className={styles.description}>Выберите файлы для передачи на компьютер</p>
          
          <div className={styles.uploadContainer}>
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange} 
              className={styles.fileInput}
              ref={fileInputRef}
              id="file-input"
            />
            <label htmlFor="file-input" className={styles.fileInputLabel}>
              Выбрать файлы
            </label>
            
            {files.length > 0 && (
              <button 
                onClick={uploadFiles} 
                className={styles.uploadButton}
                disabled={files.every(f => f.status !== 'pending')}
              >
                Загрузить файлы
              </button>
            )}
            
            {files.some(f => f.status === 'done') && (
              <button 
                onClick={clearCompleted} 
                className={styles.clearButton}
              >
                Очистить завершенные
              </button>
            )}
          </div>
          
          {files.length > 0 && (
            <div className={styles.fileList}>
              <h2>Файлы для передачи</h2>
              {files.map(fileItem => (
                <div key={fileItem.id} className={styles.fileItem}>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{fileItem.file.name}</span>
                    <span className={styles.fileSize}>
                      {(fileItem.file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <button 
                      onClick={() => removeFile(fileItem.id)}
                      className={styles.removeButton}
                      aria-label="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                  <div className={styles.progressContainer}>
                    <div 
                      className={`${styles.progressBar} ${styles[fileItem.status]}`}
                      style={{ width: `${fileItem.progress}%` }}
                    />
                  </div>
                  <span className={styles.status}>
                    {fileItem.status === 'pending' && 'Ожидание'}
                    {fileItem.status === 'uploading' && `${fileItem.progress}%`}
                    {fileItem.status === 'done' && 'Завершено'}
                    {fileItem.status === 'error' && 'Ошибка'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
