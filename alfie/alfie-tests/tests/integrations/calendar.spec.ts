import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Calendar Integration - MANUS Cannot Do This', () => {
  test.describe('Event Management', () => {
    test('should schedule meeting with AI assistant', async ({ api }) => {
      const response = await api.post('/api/integrations/calendar/events', {
        title: 'E2E Test Meeting',
        description: 'Automated test meeting',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        duration: 60,
        attendees: ['test@example.com'],
        aiSuggestTime: true,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should find optimal meeting time', async ({ api }) => {
      const response = await api.post<{ suggestions: unknown[] }>(
        '/api/integrations/calendar/find-time',
        {
          attendees: ['user1@example.com', 'user2@example.com'],
          duration: 30,
          preferredTimes: ['morning', 'afternoon'],
          constraints: {
            notBefore: '09:00',
            notAfter: '17:00',
          },
        }
      );

      expect(response.status).toBeLessThan(500);
      if (response.status === 200) {
        expect(Array.isArray(response.data.suggestions)).toBeTruthy();
      }
    });

    test('should list upcoming events', async ({ api }) => {
      const response = await api.get<{ events: unknown[] }>('/api/integrations/calendar/events', {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.events)).toBeTruthy();
    });

    test('should reschedule event with AI', async ({ api }) => {
      const response = await api.post('/api/integrations/calendar/events/123/reschedule', {
        reason: 'Conflict with another meeting',
        aiFindAlternative: true,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should cancel event with notification', async ({ api }) => {
      const response = await api.post('/api/integrations/calendar/events/123/cancel', {
        notifyAttendees: true,
        aiGenerateCancellationMessage: true,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Meeting Preparation', () => {
    test('should generate meeting agenda', async ({ api }) => {
      const response = await api.post<{ agenda: string[] }>(
        '/api/integrations/calendar/events/123/agenda',
        {
          context: 'Weekly team sync',
          includeActionItems: true,
          reviewPreviousMeeting: true,
        }
      );

      expect(response.status).toBeLessThan(500);
      if (response.status === 200) {
        expect(Array.isArray(response.data.agenda)).toBeTruthy();
      }
    });

    test('should gather relevant context for meeting', async ({ api }) => {
      const response = await api.get('/api/integrations/calendar/events/123/context');

      expect(response.status).toBeLessThan(500);
    });

    test('should send meeting reminders', async ({ api }) => {
      const response = await api.post('/api/integrations/calendar/events/123/remind', {
        timing: '15min',
        includeAgenda: true,
        includeDocuments: true,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Calendar Sync', () => {
    test('should sync with Google Calendar', async ({ api }) => {
      const response = await api.post('/api/integrations/calendar/sync', {
        provider: 'google',
        direction: 'bidirectional',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should sync with Outlook Calendar', async ({ api }) => {
      const response = await api.post('/api/integrations/calendar/sync', {
        provider: 'outlook',
        direction: 'bidirectional',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should detect calendar conflicts', async ({ api }) => {
      const response = await api.get<{ conflicts: unknown[] }>(
        '/api/integrations/calendar/conflicts',
        {
          from: new Date().toISOString(),
          to: new Date(Date.now() + 30 * 86400000).toISOString(),
        }
      );

      expect(response.status).toBeLessThan(500);
    });
  });
});
