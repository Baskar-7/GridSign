// Lightweight wrapper to load pdf.js worker from CDN.
// Using a local indirection avoids Next.js/Turbopack issues with dynamic ESM worker imports.
// If you want to pin version, update the version number below.
importScripts('https://unpkg.com/pdfjs-dist@4.4.181/build/pdf.worker.min.js');