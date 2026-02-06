import { Router } from 'express';
import multer from 'multer';
import * as meetingService from '../services/meetingService.js';
import { log } from '../services/logger.js';
import PDFDocument from 'pdfkit';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req, res) => {
  try {
    const filter = {
      search: req.query.search,
      status: req.query.status ? req.query.status.split(',') : undefined,
      isFavorite: req.query.favorite === 'true' ? true : undefined,
    };
    
    const meetings = meetingService.listMeetings(filter);
    res.json({ meetings, count: meetings.length });
  } catch (error) {
    log.error('Failed to list meetings', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const meeting = meetingService.createMeeting(req.body);
    res.status(201).json(meeting);
  } catch (error) {
    log.error('Failed to create meeting', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = meetingService.getStats();
    res.json(stats);
  } catch (error) {
    log.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const meeting = meetingService.getMeeting(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (error) {
    log.error('Failed to get meeting', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const meeting = meetingService.updateMeeting(req.params.id, req.body);
    res.json(meeting);
  } catch (error) {
    if (error.message === 'Meeting not found') {
      return res.status(404).json({ error: error.message });
    }
    log.error('Failed to update meeting', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    meetingService.deleteMeeting(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Meeting not found') {
      return res.status(404).json({ error: error.message });
    }
    log.error('Failed to delete meeting', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/transcript', (req, res) => {
  try {
    const segment = meetingService.addTranscriptSegment(req.params.id, req.body);
    res.status(201).json(segment);
  } catch (error) {
    if (error.message === 'Meeting not found') {
      return res.status(404).json({ error: error.message });
    }
    log.error('Failed to add transcript segment', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/summarize', async (req, res) => {
  try {
    const { meetingId, transcript, speakers } = req.body;
    
    if (!meetingId) {
      return res.status(400).json({ error: 'meetingId is required' });
    }
    
    let meeting = meetingService.getMeeting(meetingId);
    if (!meeting && transcript && speakers) {
      meeting = meetingService.createMeeting({
        title: 'Imported Meeting',
        speakers,
      });
      
      for (const seg of transcript) {
        meetingService.addTranscriptSegment(meeting.id, seg);
      }
    }
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const summary = await meetingService.generateSummary(meeting.id);
    res.json(summary);
  } catch (error) {
    log.error('Failed to generate summary', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    const options = {
      model: req.body.model || 'base',
      language: req.body.language || 'en',
    };
    
    const result = await meetingService.transcribeAudio(req.file.buffer, options);
    res.json(result);
  } catch (error) {
    log.error('Transcription failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/diarize', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    const options = {
      maxSpeakers: parseInt(req.body.maxSpeakers) || 6,
    };
    
    const speakers = await meetingService.detectSpeakers(req.file.buffer, options);
    res.json({ speakers });
  } catch (error) {
    log.error('Diarization failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { meetingId, format } = req.body;
    
    if (!meetingId || !format) {
      return res.status(400).json({ error: 'meetingId and format are required' });
    }
    
    const meeting = meetingService.getMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (format === 'pdf') {
      const doc = new PDFDocument();
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=meeting-${meetingId}.pdf`);
        res.send(buffer);
      });
      
      doc.fontSize(20).text(meeting.title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Date: ${new Date(meeting.startTime).toLocaleString()}`);
      doc.text(`Duration: ${Math.round(meeting.durationMs / 60000)} minutes`);
      doc.text(`Participants: ${meeting.speakers.map(s => s.name).join(', ')}`);
      doc.moveDown();
      
      if (meeting.summary) {
        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(meeting.summary.overview);
        doc.moveDown();
        
        if (meeting.summary.keyPoints.length > 0) {
          doc.fontSize(12).text('Key Points');
          meeting.summary.keyPoints.forEach(kp => {
            doc.fontSize(10).text(`  • ${kp.text}`);
          });
          doc.moveDown();
        }
        
        if (meeting.summary.actionItems.length > 0) {
          doc.fontSize(12).text('Action Items');
          meeting.summary.actionItems.forEach(ai => {
            const checkbox = ai.status === 'completed' ? '[x]' : '[ ]';
            doc.fontSize(10).text(`  ${checkbox} ${ai.text}`);
          });
          doc.moveDown();
        }
      }
      
      doc.fontSize(14).text('Transcript', { underline: true });
      doc.moveDown(0.5);
      meeting.transcript.forEach(seg => {
        const speaker = meeting.speakers.find(s => s.id === seg.speakerId);
        doc.fontSize(10).text(`[${speaker?.name || 'Unknown'}]: ${seg.text}`);
      });
      
      doc.end();
    } else if (format === 'docx') {
      res.status(501).json({ error: 'DOCX export not implemented yet' });
    } else {
      res.status(400).json({ error: 'Unsupported format. Use pdf or docx.' });
    }
  } catch (error) {
    log.error('Export failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
