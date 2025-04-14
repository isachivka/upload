import Head from "next/head";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useState, useRef, ChangeEvent, useEffect } from "react";

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
  speed?: number; // Upload speed in MB/s
  estimatedTime?: number; // Estimated time in seconds
  errorMessage?: string; // Сообщение об ошибке
}

export default function Home() {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerSupported, setIsWorkerSupported] = useState<boolean>(true);
  const [workerError, setWorkerError] = useState<string | null>(null);

  // Initialize the upload worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      try {
        // Create the worker
        workerRef.current = new Worker('/uploadWorker.js');
        
        // Set up message handlers
        workerRef.current.onmessage = handleWorkerMessage;
        
        // Обработка ошибок Worker
        workerRef.current.onerror = (error) => {
          console.error('Worker error:', error);
          setWorkerError(`Worker ошибка: ${error.message || 'Неизвестная ошибка'}`);
        };
        
        // Clean up on unmount
        return () => {
          workerRef.current?.terminate();
          workerRef.current = null;
        };
      } catch (error) {
        console.error('Error initializing Worker:', error);
        setWorkerError(`Ошибка инициализации Worker: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        setIsWorkerSupported(false);
      }
    } else {
      console.error('Web Workers are not supported in this browser');
      setWorkerError('Web Workers не поддерживаются в этом браузере');
      setIsWorkerSupported(false);
    }
  }, []);
  
  // Handle messages from the worker
  const handleWorkerMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'UPLOAD_STARTED':
        setFiles(prev => prev.map(f => 
          f.id === payload.id ? { ...f, status: 'uploading', errorMessage: undefined } : f
        ));
        break;
        
      case 'PROGRESS_UPDATE':
        setFiles(prev => prev.map(f => 
          f.id === payload.id ? { 
            ...f, 
            progress: payload.progress, 
            speed: payload.speed,
            estimatedTime: payload.estimatedTime
          } : f
        ));
        break;
        
      case 'UPLOAD_COMPLETE':
        setFiles(prev => prev.map(f => 
          f.id === payload.id ? { ...f, status: 'done', progress: 100 } : f
        ));
        break;
        
      case 'UPLOAD_ERROR':
        console.error(`Upload error for file ${payload.id}:`, payload.error);
        setFiles(prev => prev.map(f => 
          f.id === payload.id ? { 
            ...f, 
            status: 'error',
            errorMessage: payload.error || 'Неизвестная ошибка' 
          } : f
        ));
        break;
        
      case 'UPLOAD_CANCELLED':
        setFiles(prev => prev.map(f => 
          f.id === payload.id ? { ...f, status: 'pending', errorMessage: undefined } : f
        ));
        break;
        
      case 'WORKER_ERROR':
        console.error('Worker error:', payload.error, payload.stack);
        setWorkerError(payload.error);
        break;
        
      default:
        console.warn('Unknown message from worker:', type);
        setWorkerError(`Неизвестное сообщение от Worker: ${type}`);
    }
  };

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
    // If workers are not supported, fall back to the original method
    if (!isWorkerSupported || !workerRef.current) {
      for (const fileItem of files) {
        if (fileItem.status !== 'pending') continue;
        await uploadFileWithoutWorker(fileItem);
      }
      return;
    }
    
    // Use worker for uploads
    for (const fileItem of files) {
      if (fileItem.status !== 'pending') continue;
      
      // Send file to worker for upload
      workerRef.current.postMessage({
        type: 'UPLOAD_FILE',
        payload: {
          id: fileItem.id,
          file: fileItem.file
        }
      });
    }
  };

  // Original upload method (fallback if workers not supported)
  const uploadFileWithoutWorker = async (fileItem: FileWithProgress) => {
    const formData = new FormData();
    formData.append('file', fileItem.file);

    try {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading' } : f
      ));

      const xhr = new XMLHttpRequest();
      let lastLoaded = 0;
      let lastTime = Date.now();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const currentTime = Date.now();
          const timeElapsed = (currentTime - lastTime) / 1000; // in seconds
          const loadedDifference = event.loaded - lastLoaded; // in bytes
          
          // Only calculate speed if enough time has passed to avoid very small time intervals
          let speed = 0;
          let estimatedTime = undefined;
          if (timeElapsed > -0.1) {
            speed = (loadedDifference / timeElapsed) / (1024 * 1024); // MB/s
            
            // Calculate estimated time remaining
            if (speed > 0) {
              const remainingBytes = event.total - event.loaded;
              const remainingMB = remainingBytes / (1024 * 1024);
              estimatedTime = remainingMB / speed; // seconds
            }
            
            lastLoaded = event.loaded;
            lastTime = currentTime;
          }
          
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, progress, speed, estimatedTime } : f
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

  const cancelUpload = (id: string) => {
    const fileItem = files.find(f => f.id === id);
    
    if (fileItem && fileItem.status === 'uploading' && workerRef.current) {
      // Tell worker to cancel
      workerRef.current.postMessage({
        type: 'CANCEL_UPLOAD',
        payload: { id }
      });
    }
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'done'));
  };

  const removeFile = (id: string) => {
    // If file is uploading, cancel it first
    const fileItem = files.find(f => f.id === id);
    if (fileItem && fileItem.status === 'uploading') {
      cancelUpload(id);
    }
    
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Format time in seconds to a human-readable string
  const formatTime = (seconds?: number): string => {
    if (seconds === undefined || !isFinite(seconds)) return '';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
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
          
          {workerError && (
            <div className={styles.error}>
              <strong>Ошибка:</strong> {workerError}
              <button 
                onClick={() => setWorkerError(null)} 
                className={styles.closeButton}
                aria-label="Close error"
              >
                ✕
              </button>
            </div>
          )}
          
          {!isWorkerSupported && (
            <div className={styles.warning}>
              Фоновая загрузка не поддерживается в этом браузере. Загрузки могут прерываться при переключении между приложениями.
            </div>
          )}
          
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
                      onClick={() => fileItem.status === 'uploading' 
                        ? cancelUpload(fileItem.id) 
                        : removeFile(fileItem.id)
                      }
                      className={styles.removeButton}
                      aria-label={fileItem.status === 'uploading' ? "Cancel upload" : "Remove file"}
                    >
                      {fileItem.status === 'uploading' ? '⏹' : '✕'}
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
                    {fileItem.status === 'uploading' && (
                      <>
                        {`${fileItem.progress}% `}
                        {fileItem.speed !== undefined && `(${fileItem.speed.toFixed(2)} MB/s) `}
                        {fileItem.estimatedTime !== undefined && `Est: ${formatTime(fileItem.estimatedTime)}`}
                      </>
                    )}
                    {fileItem.status === 'done' && 'Завершено'}
                    {fileItem.status === 'error' && (
                      <>
                        Ошибка: {fileItem.errorMessage || 'Неизвестная ошибка'}
                      </>
                    )}
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
