import type { RoomSummary } from "./types";

function minutesAgo(base: number, minutes: number): string {
  return new Date(base - minutes * 60_000).toISOString();
}

/**
 * Labeled demo rooms for the Sprint 1 prototype. These are not server records
 * and reset when the application closes.
 *
 * Demo invitation codes:
 *   AC-WAIT  Weekend movie (waiting, 1/2)
 *   AC-7F2K  Private cinema (dormant, password: cinema-night)
 *   AC-FULL  Friday cinema (live, 2/2)
 *   AC-GONE  Unavailable
 */
export function seedRooms(now = Date.now()): RoomSummary[] {
  return [
    {
      id: "demo-friday-cinema",
      name: "Friday Cinema",
      status: "live",
      participantCount: 2,
      maxParticipants: 2,
      isPasswordProtected: false,
      createdAt: minutesAgo(now, 60 * 24 * 92),
      lastActiveAt: minutesAgo(now, 2),
      partnerDisplayName: "Ada",
      lastMediaLabel: "Feature film · 2160p",
      invitationCode: "AC-FULL",
      archived: false,
      demoPassword: null,
      isDemo: true,
    },
    {
      id: "demo-weekend-movie",
      name: "Weekend Movie",
      status: "waiting",
      participantCount: 1,
      maxParticipants: 2,
      isPasswordProtected: false,
      createdAt: minutesAgo(now, 60 * 24 * 31),
      lastActiveAt: minutesAgo(now, 14),
      partnerDisplayName: "Ada",
      lastMediaLabel: "Documentary · 1080p",
      invitationCode: "AC-WAIT",
      archived: false,
      demoPassword: null,
      isDemo: true,
    },
    {
      id: "demo-movie-night",
      name: "Movie Night",
      status: "reconnecting",
      participantCount: 1,
      maxParticipants: 2,
      isPasswordProtected: false,
      createdAt: minutesAgo(now, 60 * 24 * 15),
      lastActiveAt: minutesAgo(now, 1),
      partnerDisplayName: "Ada",
      lastMediaLabel: "Feature film · 1080p",
      invitationCode: "AC-RECN",
      archived: false,
      demoPassword: null,
      isDemo: true,
    },
    {
      id: "demo-private-cinema",
      name: "Private Cinema",
      status: "dormant",
      participantCount: 0,
      maxParticipants: 2,
      isPasswordProtected: true,
      createdAt: minutesAgo(now, 60 * 24 * 64),
      lastActiveAt: minutesAgo(now, 60 * 24 * 2),
      partnerDisplayName: "Ada",
      lastMediaLabel: "Classic film · 1080p",
      invitationCode: "AC-7F2K",
      archived: false,
      demoPassword: "cinema-night",
      isDemo: true,
    },
    {
      id: "demo-sunday-screening",
      name: "Sunday Screening",
      status: "dormant",
      participantCount: 0,
      maxParticipants: 2,
      isPasswordProtected: false,
      createdAt: minutesAgo(now, 60 * 24 * 48),
      lastActiveAt: minutesAgo(now, 60 * 24 * 6),
      partnerDisplayName: "Ada",
      lastMediaLabel: "Short film · 1080p",
      invitationCode: "AC-SUN1",
      archived: false,
      demoPassword: null,
      isDemo: true,
    },
    {
      id: "demo-new-year",
      name: "New Year Marathon",
      status: "dormant",
      participantCount: 0,
      maxParticipants: 2,
      isPasswordProtected: false,
      createdAt: minutesAgo(now, 60 * 24 * 300),
      lastActiveAt: minutesAgo(now, 60 * 24 * 120),
      partnerDisplayName: "Ada",
      lastMediaLabel: "Trilogy · 1080p",
      invitationCode: "AC-NY24",
      archived: true,
      demoPassword: null,
      isDemo: true,
    },
  ];
}
