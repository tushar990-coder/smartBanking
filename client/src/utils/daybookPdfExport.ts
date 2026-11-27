import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export type PdfPaperFormat = 'a4' | 'legal';
export type PdfOrientation = 'portrait' | 'landscape';

export interface HtmlElementPdfExportOptions {
  element: HTMLElement;
  filename: string;
  format?: PdfPaperFormat;
  orientation?: PdfOrientation;
  marginMm?: number;
  pageSelector?: string;
  chunkSelector?: string;
  shrinkToSinglePageTolerance?: number;
  onProgress?: (current: number, total: number) => void;
}

export interface DaybookPdfExportOptions {
  container: HTMLElement;
  filename: string;
  pageSelector?: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Replaces CSS color-mix(...) expressions in cloned <style> tags so html2canvas 1.4.x's
 * CSS value parser never fails or drops stylesheets when ERP theme tokens are active.
 */
function sanitizeClonedStylesheets(clonedDoc: Document, primaryHex: string): void {
  const safeTint = primaryHex || '#005689';
  const styleNodes = Array.from(clonedDoc.querySelectorAll('style'));
  for (const styleEl of styleNodes) {
    const css = styleEl.textContent;
    if (css && css.includes('color-mix(')) {
      styleEl.textContent = css.replace(/color-mix\([^)]*\)/gi, safeTint);
    }
  }
}

/**
 * Cleans screen-only toolbars/buttons and unclips scrollable inner wrappers inside a cloned DOM subtree.
 */
function prepareCloneForPdf(cloneEl: HTMLElement, paddingPx = 8): void {
  cloneEl.querySelectorAll('.no-print, .cbs-toolbar, .print\\:hidden').forEach((node) => {
    node.parentNode?.removeChild(node);
  });

  cloneEl.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, .cbs-data-content').forEach((sc) => {
    sc.style.overflow = 'visible';
    sc.style.maxHeight = 'none';
  });

  cloneEl.style.width = '100%';
  cloneEl.style.maxWidth = 'none';
  cloneEl.style.minHeight = '0';
  cloneEl.style.maxHeight = 'none';
  cloneEl.style.overflow = 'visible';
  cloneEl.style.margin = '0';
  cloneEl.style.padding = `${paddingPx}px`;
  cloneEl.style.boxShadow = 'none';
  cloneEl.style.backgroundColor = '#ffffff';
  cloneEl.style.boxSizing = 'border-box';
}

function resolvePaperGeometry(format: PdfPaperFormat, orientation: PdfOrientation) {
  const baseWidthMm = format === 'legal' ? 215.9 : 210;
  const baseHeightMm = format === 'legal' ? 355.6 : 297;

  const pdfPageWidthMm = orientation === 'landscape' ? baseHeightMm : baseWidthMm;
  const pdfPageHeightMm = orientation === 'landscape' ? baseWidthMm : baseHeightMm;

  // Crisp 96-DPI staging pixel width matching paper orientation
  const stageWidthPx =
    orientation === 'landscape'
      ? format === 'legal'
        ? 1300
        : 1085
      : format === 'legal'
      ? 816
      : 794;

  return { pdfPageWidthMm, pdfPageHeightMm, stageWidthPx };
}

/**
 * Universal safe HTML-to-PDF exporter built directly on html2canvas + jsPDF.
 * Immune to:
 * 1) `html2pdf.js` v0.14 `overlay.opacity = 0` bug (which paints 100% blank white pages in html2canvas 1.4+).
 * 2) Chromium's 32,767px / 268M-pixel <canvas> height overflow on multi-month / consolidated reports.
 * 3) `color-mix(in srgb, ...)` CSS theme token parser errors in html2canvas.
 * 4) Scroll-offset / modal overflow clipping.
 */
export async function exportHtmlElementToPdf({
  element,
  filename,
  format = 'a4',
  orientation = 'portrait',
  marginMm = 5,
  pageSelector,
  chunkSelector,
  shrinkToSinglePageTolerance = 1.08,
  onProgress
}: HtmlElementPdfExportOptions): Promise<void> {
  const rootComputed = window.getComputedStyle(document.documentElement);
  const primaryHex = (rootComputed.getPropertyValue('--color-primary') || '#005689').trim();

  const { pdfPageWidthMm, pdfPageHeightMm, stageWidthPx } = resolvePaperGeometry(format, orientation);
  const contentWidthMm = pdfPageWidthMm - marginMm * 2;
  const contentHeightMm = pdfPageHeightMm - marginMm * 2;
  const maxSafeCanvasHeightPx = 14000;

  // Determine target DOM elements to render sequentially
  let targets: HTMLElement[] = [element];
  if (pageSelector) {
    const explicitPages = Array.from(element.querySelectorAll<HTMLElement>(pageSelector));
    if (explicitPages.length > 0) {
      targets = explicitPages;
    }
  } else if (chunkSelector && element.scrollHeight > 5500) {
    const chunks = Array.from(element.querySelectorAll<HTMLElement>(chunkSelector));
    if (chunks.length > 1) {
      // Build self-contained synthetic chunks preserving top header on chunk 0 and footer on final chunk
      const syntheticTargets: HTMLElement[] = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        if (idx === 0) {
          const firstWrapper = element.cloneNode(true) as HTMLElement;
          const clonedChunks = Array.from(firstWrapper.querySelectorAll<HTMLElement>(chunkSelector));
          clonedChunks.forEach((c, cIdx) => {
            if (cIdx > 0) c.parentNode?.removeChild(c);
          });
          firstWrapper.querySelectorAll('.cbs-footer-group').forEach((f) => f.parentNode?.removeChild(f));
          syntheticTargets.push(firstWrapper);
        } else if (idx === chunks.length - 1) {
          const lastWrapper = document.createElement('div');
          lastWrapper.appendChild(chunks[idx].cloneNode(true));
          const footer = element.querySelector('.cbs-footer-group');
          if (footer) {
            lastWrapper.appendChild(footer.cloneNode(true));
          }
          syntheticTargets.push(lastWrapper);
        } else {
          syntheticTargets.push(chunks[idx]);
        }
      }
      targets = syntheticTargets;
    }
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true
  });

  // Document-origin absolute staging host (opacity MUST be 1 for html2canvas 1.4+)
  const stageHost = document.createElement('div');
  stageHost.setAttribute('data-cbs-pdf-stage', 'true');
  stageHost.style.position = 'absolute';
  stageHost.style.left = '0';
  stageHost.style.top = '0';
  stageHost.style.width = `${stageWidthPx}px`;
  stageHost.style.backgroundColor = '#ffffff';
  stageHost.style.color = '#000000';
  stageHost.style.margin = '0';
  stageHost.style.padding = '0';
  stageHost.style.opacity = '1';
  stageHost.style.zIndex = '-9999';
  stageHost.style.pointerEvents = 'none';
  stageHost.style.overflow = 'visible';
  document.body.appendChild(stageHost);

  let isFirstPdfSheet = true;

  try {
    for (let i = 0; i < targets.length; i++) {
      if (onProgress) {
        onProgress(i + 1, targets.length);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const srcEl = targets[i];
      const cloneEl = srcEl.cloneNode(true) as HTMLElement;
      prepareCloneForPdf(cloneEl, 8);

      stageHost.innerHTML = '';
      stageHost.appendChild(cloneEl);

      const rawHeightPx = Math.max(cloneEl.scrollHeight, cloneEl.offsetHeight, 1);
      const dynamicScale = Math.min(2, Math.max(1, maxSafeCanvasHeightPx / rawHeightPx));

      const canvas = await html2canvas(stageHost, {
        scale: dynamicScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: stageWidthPx,
        height: rawHeightPx,
        windowWidth: Math.max(document.documentElement.clientWidth || 0, stageWidthPx),
        windowHeight: Math.max(document.documentElement.clientHeight || 0, rawHeightPx),
        onclone: (clonedDoc) => {
          sanitizeClonedStylesheets(clonedDoc, primaryHex);
          const clonedStage = clonedDoc.querySelector('[data-cbs-pdf-stage="true"]') as HTMLElement | null;
          if (clonedStage) {
            clonedStage.style.position = 'absolute';
            clonedStage.style.left = '0';
            clonedStage.style.top = '0';
            clonedStage.style.zIndex = '2147483647';
            clonedStage.style.opacity = '1';
          }
        }
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error(`Canvas render returned empty dimensions on section ${i + 1}`);
      }

      const pxPerMm = canvas.width / contentWidthMm;
      const singleSheetMaxPx = Math.floor(contentHeightMm * pxPerMm);

      if (canvas.height <= Math.floor(singleSheetMaxPx * shrinkToSinglePageTolerance)) {
        if (!isFirstPdfSheet) {
          pdf.addPage(format, orientation);
        }
        isFirstPdfSheet = false;

        const naturalHeightMm = canvas.height / pxPerMm;
        if (naturalHeightMm <= contentHeightMm) {
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, naturalHeightMm, undefined, 'FAST');
        } else {
          const fitRatio = contentHeightMm / naturalHeightMm;
          const fittedWidthMm = contentWidthMm * fitRatio;
          const offsetXMm = marginMm + (contentWidthMm - fittedWidthMm) / 2;
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          pdf.addImage(imgData, 'JPEG', offsetXMm, marginMm, fittedWidthMm, contentHeightMm, undefined, 'FAST');
        }
      } else {
        let offsetYPx = 0;
        while (offsetYPx < canvas.height) {
          const sliceHeightPx = Math.min(singleSheetMaxPx, canvas.height - offsetYPx);
          if (sliceHeightPx <= 4) break;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeightPx;

          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) {
            throw new Error('2D canvas context unavailable during PDF slicing');
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offsetYPx,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );

          if (!isFirstPdfSheet) {
            pdf.addPage(format, orientation);
          }
          isFirstPdfSheet = false;

          const sliceHeightMm = sliceHeightPx / pxPerMm;
          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm, contentWidthMm, sliceHeightMm, undefined, 'FAST');

          offsetYPx += sliceHeightPx;
        }
      }
    }

    const finalName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(finalName);
  } finally {
    if (stageHost.parentNode) {
      stageHost.parentNode.removeChild(stageHost);
    }
  }
}

/**
 * Dedicated wrapper for Daybook & LegacyDaybook multi-day `.daybook-page` reports.
 */
export async function exportDaybookPagesToPdf({
  container,
  filename,
  pageSelector = '.daybook-page',
  onProgress
}: DaybookPdfExportOptions): Promise<void> {
  return exportHtmlElementToPdf({
    element: container,
    filename,
    format: 'a4',
    orientation: 'landscape',
    marginMm: 5,
    pageSelector,
    shrinkToSinglePageTolerance: 1.08,
    onProgress
  });
}
