// Upload Worker - handles file uploads in a background thread
// This worker will continue running even when the app is in the background

// Store active uploads
const activeUploads = new Map();

// Перехват всех необработанных ошибок в worker
self.addEventListener('error', function(event) {
  console.error('Worker global error:', event.message);
  self.postMessage({
    type: 'WORKER_ERROR',
    payload: {
      error: `Глобальная ошибка Worker: ${event.message}`,
      stack: event.error?.stack || 'Stack not available'
    }
  });
});

self.addEventListener('message', function(e) {
  try {
    const { type, payload } = e.data;
    
    switch (type) {
      case 'UPLOAD_FILE':
        startUpload(payload);
        break;
      case 'CANCEL_UPLOAD':
        cancelUpload(payload.id);
        break;
      default:
        console.error('Unknown message type:', type);
        self.postMessage({
          type: 'WORKER_ERROR',
          payload: {
            error: `Неизвестный тип сообщения: ${type}`
          }
        });
    }
  } catch (error) {
    console.error('Error processing message in worker:', error);
    self.postMessage({
      type: 'WORKER_ERROR',
      payload: {
        error: `Ошибка обработки сообщения: ${error.message || 'Неизвестная ошибка'}`,
        stack: error.stack || 'Stack not available'
      }
    });
  }
});

// Start a file upload
function startUpload({ file, id }) {
  try {
    // Create FormData (can't pass FormData directly to worker)
    const formData = new FormData();
    formData.append('file', file);
    
    // Create XHR for the upload
    const xhr = new XMLHttpRequest();
    activeUploads.set(id, xhr);
    
    let lastLoaded = 0;
    let lastTime = Date.now();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      try {
        if (event.lengthComputable) {
          const currentTime = Date.now();
          const timeElapsed = (currentTime - lastTime) / 1000; // in seconds
          const loadedDifference = event.loaded - lastLoaded; // in bytes
          
          // Only calculate speed if enough time has passed
          let speed = 0;
          let estimatedTime = undefined;
          if (timeElapsed > 0.1) {
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
          
          // Send progress update to main thread
          self.postMessage({
            type: 'PROGRESS_UPDATE',
            payload: {
              id,
              progress,
              speed,
              estimatedTime
            }
          });
        }
      } catch (error) {
        console.error('Error in progress handler:', error);
        self.postMessage({
          type: 'UPLOAD_ERROR',
          payload: {
            id,
            error: `Ошибка в обработчике прогресса: ${error.message || 'Неизвестная ошибка'}`
          }
        });
      }
    });
    
    // Set up completion handler
    xhr.onload = function() {
      try {
        activeUploads.delete(id);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          self.postMessage({
            type: 'UPLOAD_COMPLETE',
            payload: {
              id,
              success: true,
              response: xhr.responseText
            }
          });
        } else {
          self.postMessage({
            type: 'UPLOAD_ERROR',
            payload: {
              id,
              status: xhr.status,
              error: `HTTP ошибка ${xhr.status}: ${xhr.statusText || ''} ${xhr.responseText || ''}`
            }
          });
        }
      } catch (error) {
        console.error('Error in onload handler:', error);
        self.postMessage({
          type: 'UPLOAD_ERROR',
          payload: {
            id,
            error: `Ошибка в обработчике завершения: ${error.message || 'Неизвестная ошибка'}`
          }
        });
      }
    };
    
    // Set up error handler
    xhr.onerror = function(event) {
      try {
        console.error('XHR error event:', event);
        activeUploads.delete(id);
        self.postMessage({
          type: 'UPLOAD_ERROR',
          payload: {
            id,
            error: `Сетевая ошибка: ${xhr.statusText || 'Детали недоступны'}`
          }
        });
      } catch (error) {
        console.error('Error in error handler:', error);
        self.postMessage({
          type: 'UPLOAD_ERROR',
          payload: {
            id,
            error: `Ошибка в обработчике ошибок: ${error.message || 'Неизвестная ошибка'}`
          }
        });
      }
    };
    
    // Set up abort handler
    xhr.onabort = function() {
      try {
        activeUploads.delete(id);
        self.postMessage({
          type: 'UPLOAD_CANCELLED',
          payload: { id }
        });
      } catch (error) {
        console.error('Error in abort handler:', error);
      }
    };
    
    // Set timeout handler
    xhr.ontimeout = function() {
      try {
        activeUploads.delete(id);
        self.postMessage({
          type: 'UPLOAD_ERROR',
          payload: {
            id,
            error: 'Таймаут соединения'
          }
        });
      } catch (error) {
        console.error('Error in timeout handler:', error);
      }
    };
    
    // Start the upload
    try {
      xhr.open('POST', '/api/upload');
      // Пробуем увеличить таймаут
      xhr.timeout = 300000; // 5 минут
      xhr.send(formData);
      
      // Notify that upload has started
      self.postMessage({
        type: 'UPLOAD_STARTED',
        payload: { id }
      });
    } catch (error) {
      console.error('Error starting upload:', error);
      activeUploads.delete(id);
      self.postMessage({
        type: 'UPLOAD_ERROR',
        payload: {
          id,
          error: `Ошибка запуска загрузки: ${error.message || 'Неизвестная ошибка'}`
        }
      });
    }
  } catch (error) {
    console.error('Error in startUpload:', error);
    self.postMessage({
      type: 'UPLOAD_ERROR',
      payload: {
        id,
        error: `Общая ошибка загрузки: ${error.message || 'Неизвестная ошибка'}`
      }
    });
  }
}

// Cancel an active upload
function cancelUpload(id) {
  try {
    const xhr = activeUploads.get(id);
    if (xhr) {
      xhr.abort();
      activeUploads.delete(id);
    }
  } catch (error) {
    console.error('Error cancelling upload:', error);
    self.postMessage({
      type: 'WORKER_ERROR',
      payload: {
        error: `Ошибка отмены загрузки: ${error.message || 'Неизвестная ошибка'}`
      }
    });
  }
} 