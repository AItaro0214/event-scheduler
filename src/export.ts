import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { h, render } from "preact";
import { PageView } from "./components/PageView";
import { serializeSheet } from "./io";
import type { Sheet } from "./types";

const A4 = { w: 297, h: 210 }; // mm, landscape

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Render every page into an offscreen stage at 1:1 logical size, rasterise with
 * html2canvas (scale 2) and place each bitmap on an A4 landscape PDF page.
 * No fonts are embedded: text is already pixels, so Japanese needs nothing extra.
 */
export async function renderPdf(sheet: Sheet, onProgress?: (i: number, n: number) => void): Promise<Blob> {
  const stage = document.createElement("div");
  stage.className = "export-stage";
  document.body.appendChild(stage);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  try {
    for (let i = 0; i < sheet.pages.length; i++) {
      onProgress?.(i, sheet.pages.length);
      render(h(PageView, { sheet, page: sheet.pages[i], exportMode: true }), stage);
      await nextFrame();
      await document.fonts?.ready;
      const el = stage.firstElementChild as HTMLElement;
      const w = el.offsetWidth;
      const hgt = el.offsetHeight;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: false,
        width: w,
        height: hgt,
        windowWidth: w,
        windowHeight: hgt,
        scrollX: 0,
        scrollY: 0,
      });
      const img = canvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) pdf.addPage("a4", "landscape");
      const ratio = Math.min(A4.w / w, A4.h / hgt);
      const dw = w * ratio;
      const dh = hgt * ratio;
      pdf.addImage(img, "JPEG", (A4.w - dw) / 2, (A4.h - dh) / 2, dw, dh, undefined, "FAST");
    }
  } finally {
    render(null, stage);
    stage.remove();
  }
  return pdf.output("blob");
}

export function jsonBlob(sheet: Sheet): Blob {
  return new Blob([JSON.stringify(serializeSheet(sheet), null, 2)], { type: "application/json" });
}
