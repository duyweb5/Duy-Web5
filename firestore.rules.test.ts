/**
 * Meet Boston CMS — Phase 0 Security Specification Test Suite ("Dirty Dozen")
 * Verifies all 12 adversarial payloads are rejected by firestore.rules invariants.
 * Run against Firebase Emulator Suite with @firebase/rules-unit-testing when testing locally.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedRule: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated CMS Experience Create',
    operation: 'create',
    path: '/experiences/exp-hack',
    auth: null,
    payload: { titleVi: 'Hack', published: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'isAdmin() gate blocks unauthenticated writes',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof on SiteConfig',
    operation: 'update',
    path: '/siteConfig/main',
    auth: { uid: 'spoof-uid', email: 'duyweb5@gmail.com', email_verified: false },
    payload: { headlineVi: 'Defaced' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'isVerifiedUser() enforces email_verified == true',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Privilege Escalation',
    operation: 'create',
    path: '/admins/attacker-uid',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    payload: { email: 'attacker@example.com', displayName: 'Attacker', role: 'admin', addedBy: 'attacker-uid' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'Only isBootstrappedAdmin() can write /admins/{userId}',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Public Guide Lead',
    operation: 'create',
    path: '/guideLeads/lead-shadow-1',
    auth: null,
    payload: {
      email: 'visitor@example.com',
      source: 'visitor_guide',
      lang: 'vi',
      status: 'new',
      isVerified: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'isValidGuideLead() enforces keys().hasOnly(...)',
  },
  {
    id: 5,
    name: 'Status Shortcutting on Meeting RFP Create',
    operation: 'create',
    path: '/meetingRfps/rfp-shortcut',
    auth: null,
    payload: {
      organization: 'Acme Corp',
      email: 'ceo@acme.com',
      guests: '150 - 500',
      timeframe: 'Q2 2027',
      notes: '',
      status: 'responded',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'create requires incoming().status == "new"',
  },
  {
    id: 6,
    name: 'Non-Admin PII Read Attempt on Guide Leads',
    operation: 'list',
    path: '/guideLeads',
    auth: { uid: 'regular-user', email: 'guest@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'PII Isolation restricts guideLeads reads strictly to admins',
  },
  {
    id: 7,
    name: 'Public Scraping of Unpublished Draft Experience',
    operation: 'get',
    path: '/experiences/exp-draft-secret',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'allow get requires existing().published == true || isAdmin()',
  },
  {
    id: 8,
    name: 'Path ID Poisoning Attack on Lead Create',
    operation: 'create',
    path: '/guideLeads/bad$id!' + 'a'.repeat(140),
    auth: null,
    payload: { email: 'visitor@example.com', source: 'newsletter', lang: 'en', status: 'new' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'isValidId() enforces regex ^[a-zA-Z0-9_\\-]+$ and size <= 128',
  },
  {
    id: 9,
    name: 'Client-Forged Timestamp on Guide Lead',
    operation: 'create',
    path: '/guideLeads/lead-fake-time',
    auth: null,
    payload: {
      email: 'visitor@example.com',
      source: 'visitor_guide',
      lang: 'vi',
      status: 'new',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'Temporal integrity requires createdAt == request.time',
  },
  {
    id: 10,
    name: 'Immutable Field Tampering (createdBy) on Update',
    operation: 'update',
    path: '/experiences/exp-freedom-trail',
    auth: { uid: 'admin-uid', email: 'duyweb5@gmail.com', email_verified: true },
    payload: { createdBy: 'other-uid' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'createdBy == existing().createdBy && affectedKeys().hasOnly(...)',
  },
  {
    id: 11,
    name: 'Array Overflow (Denial of Wallet) on Hotel Amenities',
    operation: 'create',
    path: '/hotels/htl-overflow',
    auth: { uid: 'admin-uid', email: 'duyweb5@gmail.com', email_verified: true },
    payload: { amenitiesVi: Array.from({ length: 25 }, (_, i) => `Amenity ${i}`) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'isValidHotel() enforces amenitiesVi.size() <= 10',
  },
  {
    id: 12,
    name: 'Value Poisoning (Out-of-Bounds WalkScore & Negative Rate)',
    operation: 'update',
    path: '/hotels/htl-newbury',
    auth: { uid: 'admin-uid', email: 'duyweb5@gmail.com', email_verified: true },
    payload: { rateUsd: -500 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRule: 'isValidHotel() enforces rateUsd >= 10 && rateUsd <= 25000',
  },
];
