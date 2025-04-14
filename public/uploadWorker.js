// Upload Worker - handles file uploads in a background thread
// This worker will continue running even when the app is in the background

// Store active uploads
const activeUploads = new Map();

self.addEventListener('message', function(e) {
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
  }
});

// Start a file upload
function startUpload({ file, id }) {
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
  });
  
  // Set up completion handler
  xhr.onload = function() {
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
          error: `HTTP error ${xhr.status}`
        }
      });
    }
  };
  
  // Set up error handler
  xhr.onerror = function() {
    activeUploads.delete(id);
    self.postMessage({
      type: 'UPLOAD_ERROR',
      payload: {
        id,
        error: 'Network error occurred'
      }
    });
  };
  
  // Set up abort handler
  xhr.onabort = function() {
    activeUploads.delete(id);
    self.postMessage({
      type: 'UPLOAD_CANCELLED',
      payload: { id }
    });
  };
  
  // Start the upload
  xhr.open('POST', '/api/upload');
  xhr.send(formData);
  
  // Notify that upload has started
  self.postMessage({
    type: 'UPLOAD_STARTED',
    payload: { id }
  });
}

// Cancel an active upload
function cancelUpload(id) {
  const xhr = activeUploads.get(id);
  if (xhr) {
    xhr.abort();
    activeUploads.delete(id);
  }
} 