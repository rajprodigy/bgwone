import * as pdfjsLib from 'pdfjs-dist';

// Use fast jsDelivr CDN for worker to avoid complex Vite worker configuration issues in this environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPdf(
  data: ArrayBuffer | Uint8Array | string,
  maxCharacters: number = 100000
): Promise<string> {
  let bytes: Uint8Array;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    const binary = atob(data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  
  const totalPages = pdf.numPages;
  const pages: { pageNum: number; text: string }[] = [];
  let accumulatedLength = 0;

  // Extract pages sequentially: stops immediately when character limit is reached,
  // avoiding CPU & memory waste on extracting later pages from massive PDFs (such as 65MB files).
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (accumulatedLength >= maxCharacters) {
      break;
    }

    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        // @ts-ignore
        .map((item) => item.str)
        .join(" ");
      
      const formattedText = `--- Page ${pageNum} ---\n${pageText}\n\n`;
      pages.push({ pageNum, text: formattedText });
      accumulatedLength += formattedText.length;
    } catch (err) {
      console.error(`Error parsing page ${pageNum}:`, err);
      pages.push({ 
        pageNum, 
        text: `--- Page ${pageNum} ---\n[Extraction failed]\n\n` 
      });
    }
  }

  return pages.map((p) => p.text).join("");
}

export function chunkText(text: string, size: number = 1000, overlap: number = 200, maxChunks?: number): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    if (maxChunks !== undefined && chunks.length >= maxChunks) {
      
      break;
    }
    const end = Math.min(index + size, text.length);
    chunks.push(text.slice(index, end));
    index += (size - overlap);
  }

  return chunks;
}
