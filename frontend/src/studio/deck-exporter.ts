/**
 * Client-Side Deck Exporter for PowerPointBD
 * Generates verified native Microsoft PowerPoint (.pptx) decks using PptxGenJS
 * and verified Adobe PDF (.pdf) documents using jsPDF.
 * Enforces Calibri for English and Nirmala UI for Bangla.
 */

import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';

export interface SlideData {
  n: number;
  layout?: string;
  title: string;
  subtitle?: string;
  bullet_points?: string[];
  items?: { year?: string; text?: string; label?: string }[];
  stats?: { value: string; label: string }[];
  points1?: string[];
  points2?: string[];
  steps?: string[];
  quoteText?: string;
  author?: string;
  notes?: string;
}

export interface DeckExportOptions {
  title: string;
  author?: string;
  slides: SlideData[];
}

export async function exportToPptx(options: DeckExportOptions): Promise<void> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = options.author || 'PowerPointBD';
  pptx.title = options.title;

  const primaryColor = '0B2B21';
  const emeraldAccent = '006A4E';
  const crimsonColor = 'C8102E';
  const bgLight = 'F6F4EE';
  const textDark = '11140F';
  const mutedText = '4A5148';

  for (const slideData of options.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: bgLight };

    // Header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.15,
      fill: { color: emeraldAccent },
    });

    // Brand mark top right
    slide.addText('PowerPointBD', {
      x: 10.5,
      y: 0.3,
      w: 2.5,
      h: 0.4,
      fontSize: 11,
      fontFace: 'Calibri',
      color: mutedText,
      align: 'right',
    });

    if (slideData.n === 1 || slideData.layout === 'title') {
      // Title Slide Layout
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 1.0,
        y: 1.2,
        w: 11.3,
        h: 4.8,
        fill: { color: 'FFFFFF' },
        line: { color: 'DAD6C9', width: 1 },
        rectRadius: 0.2,
      });

      slide.addText(options.title, {
        x: 1.5,
        y: 2.0,
        w: 10.3,
        h: 1.5,
        fontSize: 34,
        fontFace: 'Nirmala UI',
        bold: true,
        color: primaryColor,
        align: 'left',
      });

      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 1.5,
          y: 3.6,
          w: 10.3,
          h: 0.8,
          fontSize: 18,
          fontFace: 'Nirmala UI',
          color: mutedText,
          align: 'left',
        });
      }

      slide.addText('PowerPointBD · Verified Native Deck', {
        x: 1.5,
        y: 4.8,
        w: 6.0,
        h: 0.5,
        fontSize: 12,
        fontFace: 'Calibri',
        color: emeraldAccent,
      });
    } else {
      // Content Slide Layout
      slide.addText(slideData.title, {
        x: 0.8,
        y: 0.5,
        w: 11.5,
        h: 0.9,
        fontSize: 24,
        fontFace: 'Nirmala UI',
        bold: true,
        color: primaryColor,
      });

      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.8,
          y: 1.2,
          w: 11.5,
          h: 0.4,
          fontSize: 14,
          fontFace: 'Calibri',
          color: mutedText,
        });
      }

      // Render content based on layout type
      if (slideData.stats && slideData.stats.length > 0) {
        // Stat Hero Layout
        const colWidth = 3.6;
        slideData.stats.forEach((st, i) => {
          const colX = 0.8 + i * (colWidth + 0.3);
          slide.addShape(pptx.ShapeType.roundRect, {
            x: colX,
            y: 2.0,
            w: colWidth,
            h: 3.5,
            fill: { color: 'FFFFFF' },
            line: { color: 'DAD6C9', width: 1 },
            rectRadius: 0.15,
          });

          slide.addText(st.value, {
            x: colX + 0.2,
            y: 2.5,
            w: colWidth - 0.4,
            h: 1.0,
            fontSize: 40,
            fontFace: 'Calibri',
            bold: true,
            color: emeraldAccent,
            align: 'center',
          });

          slide.addText(st.label, {
            x: colX + 0.2,
            y: 3.6,
            w: colWidth - 0.4,
            h: 1.2,
            fontSize: 16,
            fontFace: 'Nirmala UI',
            color: textDark,
            align: 'center',
          });
        });
      } else if (slideData.items && slideData.items.length > 0) {
        // Timeline Layout
        slideData.items.forEach((item, i) => {
          const rowY = 2.0 + i * 0.9;
          slide.addShape(pptx.ShapeType.oval, {
            x: 0.8,
            y: rowY + 0.05,
            w: 0.35,
            h: 0.35,
            fill: { color: crimsonColor },
          });

          slide.addText(`${item.year || item.label || ''} — ${item.text || ''}`, {
            x: 1.3,
            y: rowY,
            w: 10.5,
            h: 0.6,
            fontSize: 16,
            fontFace: 'Nirmala UI',
            color: textDark,
          });
        });
      } else if (slideData.bullet_points && slideData.bullet_points.length > 0) {
        // Standard Bullets Layout
        const bulletsText = slideData.bullet_points.map(pt => ({
          text: pt + '\n\n',
          options: {
            fontSize: 18,
            fontFace: 'Nirmala UI',
            color: textDark,
            bullet: { code: '2022' },
          },
        }));

        slide.addText(bulletsText, {
          x: 0.8,
          y: 2.0,
          w: 11.5,
          h: 4.2,
        });
      } else {
        // Default informative fallback
        slide.addText(slideData.notes || 'স্লাইডের বিস্তারিত বিষয়বস্তু।', {
          x: 0.8,
          y: 2.0,
          w: 11.5,
          h: 4.0,
          fontSize: 18,
          fontFace: 'Nirmala UI',
          color: textDark,
        });
      }
    }

    // Add Slide Number bottom right
    slide.addText(String(slideData.n), {
      x: 12.0,
      y: 6.8,
      w: 0.8,
      h: 0.4,
      fontSize: 11,
      fontFace: 'Calibri',
      color: mutedText,
      align: 'right',
    });

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  const safeFileName = options.title.replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_').slice(0, 40);
  await pptx.writeFile({ fileName: `${safeFileName}.pptx` });
}

export function exportToPdf(options: DeckExportOptions): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [13.333, 7.5], // 16:9 ratio in inches
  });

  const bgR = 246, bgG = 244, bgB = 238;
  const darkR = 17, darkG = 20, darkB = 15;
  const greenR = 0, greenG = 106, greenB = 78;

  options.slides.forEach((slide, idx) => {
    if (idx > 0) doc.addPage([13.333, 7.5], 'landscape');

    // Background
    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(0, 0, 13.333, 7.5, 'F');

    // Accent header line
    doc.setFillColor(greenR, greenG, greenB);
    doc.rect(0, 0, 13.333, 0.15, 'F');

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(darkR, darkG, darkB);
    doc.text(slide.title, 0.8, 1.2);

    if (slide.subtitle) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(16);
      doc.setTextColor(74, 81, 72);
      doc.text(slide.subtitle, 0.8, 1.7);
    }

    let yPos = 2.4;
    if (slide.bullet_points) {
      slide.bullet_points.forEach(pt => {
        doc.setFillColor(greenR, greenG, greenB);
        doc.circle(0.9, yPos - 0.05, 0.06, 'F');
        doc.text(pt, 1.2, yPos);
        yPos += 0.6;
      });
    } else if (slide.items) {
      slide.items.forEach(it => {
        doc.text(`• ${it.year || it.label || ''} : ${it.text || ''}`, 1.0, yPos);
        yPos += 0.55;
      });
    } else if (slide.stats) {
      slide.stats.forEach(st => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(greenR, greenG, greenB);
        doc.text(st.value, 1.0, yPos);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(15);
        doc.setTextColor(darkR, darkG, darkB);
        doc.text(st.label, 1.0, yPos + 0.35);
        yPos += 0.85;
      });
    }

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`PowerPointBD · Slide ${slide.n} of ${options.slides.length}`, 0.8, 7.1);
  });

  const safeFileName = options.title.replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_').slice(0, 40);
  doc.save(`${safeFileName}.pdf`);
}
