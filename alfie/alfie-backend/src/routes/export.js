import { Router } from 'express';

const router = Router();

// POST /api/export/pptx — Generate PPTX from slide data
router.post('/pptx', async (req, res) => {
  try {
    const { slides, title, author } = req.body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ error: 'slides array required' });
    }

    // Dynamic import to avoid top-level loading issues
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();

    pptx.title = title || 'ALFIE Presentation';
    pptx.author = author || 'ALFIE AI';
    pptx.company = 'ALFIE';
    pptx.layout = 'LAYOUT_WIDE';

    // Define theme colors
    const primaryColor = '8b5cf6';
    const accentColor = '06b6d4';
    const bgColor = '0f172a';
    const textColor = 'f8fafc';
    const mutedColor = '94a3b8';

    for (const [index, slideData] of slides.entries()) {
      const slide = pptx.addSlide();

      slide.background = { color: bgColor };

      // Slide number
      slide.addText(`${index + 1}/${slides.length}`, {
        x: 12.2,
        y: 7.0,
        w: 1.0,
        h: 0.3,
        fontSize: 9,
        color: mutedColor,
        align: 'right',
      });

      if (index === 0 && slideData.title) {
        // Title slide
        slide.addText(slideData.title, {
          x: 0.8,
          y: 2.0,
          w: 11.5,
          h: 1.5,
          fontSize: 40,
          fontFace: 'Helvetica',
          color: textColor,
          bold: true,
          align: 'center',
        });

        if (slideData.subtitle || slideData.content) {
          slide.addText(slideData.subtitle || slideData.content, {
            x: 1.5,
            y: 3.8,
            w: 10.0,
            h: 1.0,
            fontSize: 20,
            fontFace: 'Helvetica',
            color: mutedColor,
            align: 'center',
          });
        }

        // Accent line
        slide.addShape('rect', {
          x: 5.0,
          y: 3.5,
          w: 3.0,
          h: 0.04,
          fill: { color: primaryColor },
        });
      } else {
        // Content slide
        if (slideData.title) {
          slide.addText(slideData.title, {
            x: 0.8,
            y: 0.4,
            w: 11.5,
            h: 0.8,
            fontSize: 28,
            fontFace: 'Helvetica',
            color: textColor,
            bold: true,
          });

          // Accent underline
          slide.addShape('rect', {
            x: 0.8,
            y: 1.15,
            w: 2.0,
            h: 0.04,
            fill: { color: primaryColor },
          });
        }

        if (slideData.content) {
          // Parse bullet points from markdown-style content
          const lines = slideData.content.split('\n').filter(l => l.trim());
          const bulletPoints = [];

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
              bulletPoints.push({
                text: trimmed.replace(/^[-*•]\s*/, ''),
                options: {
                  fontSize: 16,
                  color: textColor,
                  bullet: { code: '2022', color: primaryColor },
                  paraSpaceAfter: 8,
                  fontFace: 'Helvetica',
                },
              });
            } else if (/^\d+[.)]\s/.test(trimmed)) {
              bulletPoints.push({
                text: trimmed.replace(/^\d+[.)]\s*/, ''),
                options: {
                  fontSize: 16,
                  color: textColor,
                  bullet: { type: 'number', color: accentColor },
                  paraSpaceAfter: 8,
                  fontFace: 'Helvetica',
                },
              });
            } else {
              bulletPoints.push({
                text: trimmed,
                options: {
                  fontSize: 16,
                  color: textColor,
                  paraSpaceAfter: 10,
                  fontFace: 'Helvetica',
                },
              });
            }
          }

          if (bulletPoints.length > 0) {
            slide.addText(bulletPoints, {
              x: 0.8,
              y: 1.5,
              w: 11.5,
              h: 5.0,
              valign: 'top',
            });
          }
        }

        // Notes
        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      }
    }

    const buffer = await pptx.write({ outputType: 'nodebuffer' });

    const filename = (title || 'presentation').replace(/[^a-zA-Z0-9-_]/g, '_');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filename}.pptx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (error) {
    console.error('PPTX export error:', error);
    res.status(500).json({ error: 'Failed to generate PPTX' });
  }
});

export default router;
