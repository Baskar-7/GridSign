// Public pdf.js worker shim served statically.
// Loads the actual pdf.js worker bundle from the installed version via CDN fallback.
// Pin to the installed pdfjs-dist version for reproducibility.
// Version: 5.4.296
importScripts('https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.js');
