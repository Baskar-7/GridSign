declare module 'pdfjs-dist/build/pdf.mjs' {
  // Minimal type surface needed for our setup logic.
  export const version: string;
  export const GlobalWorkerOptions: { workerSrc: string };
  export const disableWorker: boolean;
}

// Asset URL import for Turbopack: returns string path to worker script
declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const workerSrc: string;
  export default workerSrc;
}