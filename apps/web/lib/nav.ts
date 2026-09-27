import type { Role } from './api';

export interface NavItem {
  href: string;
  label: string;
}

// Main navigation for each role. Admins use the separate admin console layout.
export const NAV: Record<Exclude<Role, 'ADMIN'>, NavItem[]> = {
  TRAINEE: [
    { href: '/my-courses', label: 'My courses' },
    { href: '/courses', label: 'Browse courses' },
    { href: '/library', label: 'Library' },
    { href: '/profile', label: 'Profile' },
  ],
  TRAINER: [
    { href: '/trainer/courses', label: 'My teaching' },
    { href: '/courses', label: 'Course catalogue' },
    { href: '/trainer/library', label: 'My uploads' },
    { href: '/library', label: 'Library' },
    { href: '/profile', label: 'Profile & claims' },
  ],
};

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/skill-gaps', label: 'Skill gaps' },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/applications', label: 'Trainer applications' },
  { href: '/admin/subjects', label: 'Trainer matching' },
  { href: '/admin/announcements', label: 'Announcements' },
];
