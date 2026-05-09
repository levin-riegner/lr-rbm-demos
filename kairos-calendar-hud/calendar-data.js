var CALENDAR_DATA = {
  events: [
    // Monday Apr 20
    {
      id: 'ev001', title: 'Team Standup', type: 'meeting',
      date: '2026-04-20', startTime: '09:00', endTime: '09:20',
      location: 'Google Meet', description: 'Daily sync on blockers and priorities.',
      tags: ['team', 'daily'], attendeeCount: 6, recurring: true
    },
    {
      id: 'ev002', title: 'Code Review: Auth Refactor', type: 'task',
      date: '2026-04-20', startTime: '14:00', endTime: '15:00',
      location: 'GitHub', description: 'Review PR #2847 — auth middleware rewrite.',
      tags: ['code', 'auth'], attendeeCount: 2
    },
    // Tuesday Apr 21
    {
      id: 'ev003', title: '1:1 with Manager', type: 'meeting',
      date: '2026-04-21', startTime: '10:00', endTime: '10:30',
      location: 'Zoom', description: 'Weekly check-in on roadmap and growth.',
      tags: ['1:1', 'growth'], attendeeCount: 2, isCommitment: true
    },
    {
      id: 'ev004', title: 'Design System Review', type: 'meeting',
      date: '2026-04-21', startTime: '15:00', endTime: '16:00',
      location: 'Figma', description: 'Review component library updates for Q2.',
      tags: ['design', 'ux'], attendeeCount: 5
    },
    // Wednesday Apr 22 (TODAY)
    {
      id: 'ev005', title: 'Morning Standup', type: 'meeting',
      date: '2026-04-22', startTime: '09:00', endTime: '09:20',
      location: 'Google Meet', description: 'Daily team sync.',
      tags: ['team', 'daily'], attendeeCount: 6, recurring: true
    },
    {
      id: 'ev006', title: 'Product Sync', type: 'meeting',
      date: '2026-04-22', startTime: '11:00', endTime: '11:45',
      location: 'Zoom', description: 'Cross-functional product review with PM and Design.',
      tags: ['product', 'roadmap'], attendeeCount: 8
    },
    {
      id: 'ev007', title: 'Lunch Break', type: 'break',
      date: '2026-04-22', startTime: '12:00', endTime: '13:00',
      location: '', description: '',
      tags: ['break'], attendeeCount: 0
    },
    {
      id: 'ev008', title: 'Engineering All-Hands', type: 'meeting',
      date: '2026-04-22', startTime: '14:00', endTime: '15:30',
      location: 'Main Conference Room',
      description: 'Quarterly engineering org update. Q2 priorities, infra roadmap, and team announcements.',
      tags: ['all-hands', 'engineering'], attendeeCount: 42, isCommitment: true
    },
    {
      id: 'ev009', title: 'Sprint Planning', type: 'meeting',
      date: '2026-04-22', startTime: '16:00', endTime: '17:30',
      location: 'War Room B', description: 'Plan sprint 23 scope and assign tickets.',
      tags: ['sprint', 'planning'], attendeeCount: 7, isCommitment: true
    },
    // Thursday Apr 23
    {
      id: 'ev010', title: 'Architecture Review', type: 'meeting',
      date: '2026-04-23', startTime: '10:00', endTime: '11:30',
      location: 'Zoom', description: 'Review HUD data pipeline architecture for v2.',
      tags: ['architecture', 'infra'], attendeeCount: 4
    },
    {
      id: 'ev011', title: 'Team Offsite', type: 'personal',
      date: '2026-04-23', startTime: '14:00', endTime: '18:00',
      location: 'Dolores Park', description: 'Q2 team offsite — retrospective and social.',
      tags: ['offsite', 'social'], attendeeCount: 12
    },
    // Friday Apr 24
    {
      id: 'ev012', title: 'Sprint Retrospective', type: 'meeting',
      date: '2026-04-24', startTime: '11:00', endTime: '12:00',
      location: 'Google Meet', description: 'Sprint 22 retro — wins, misses, improvements.',
      tags: ['retro', 'sprint'], attendeeCount: 7
    },
    {
      id: 'ev013', title: 'Focus Block', type: 'task',
      date: '2026-04-24', startTime: '13:00', endTime: '17:00',
      location: '', description: 'Deep work on glasses display rendering pipeline.',
      tags: ['deep-work', 'focus'], attendeeCount: 0, isCommitment: true
    }
  ]
};
