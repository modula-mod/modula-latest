/**
 * DRAFT legal copy for modula.digital/privacy and /terms.
 * Not reviewed by counsel and not yet in effect. Keep statements factual:
 * every practice described here must match what the product actually does.
 */
export type LegalSection = {heading: string; paragraphs: string[]}
export type LegalDocument = {
  id: 'privacy' | 'terms'
  title: string
  status: 'DRAFT'
  lastUpdated: string
  summary: string
  sections: LegalSection[]
}

export const LEGAL_CONTACT = {
  privacy: 'privacy@modula.digital',
  support: 'support@modula.digital',
} as const

export const PRIVACY_DRAFT: LegalDocument = {
  id: 'privacy',
  title: 'Privacy Policy',
  status: 'DRAFT',
  lastUpdated: '2026-10-03',
  summary:
    'This is a draft. It describes how Modula handles your information today, but it has not been reviewed by counsel and is not yet in effect.',
  sections: [
    {
      heading: 'What we collect',
      paragraphs: [
        'Account details you give us: your email address, username, display name, profile photo and any profile fields you fill in.',
        'What you create: posts, comments, stories, messages, collections, drafts you sync and files you upload.',
        'Sign-in and security data: session records (device type, app version, approximate time of last use), passkeys and authenticator setup, and security events such as password changes.',
        'Support requests: what you write to us and, only if you choose to attach it, basic diagnostics such as app version and device model.',
      ],
    },
    {
      heading: 'What we don’t do',
      paragraphs: [
        'We don’t sell your personal information and we don’t show third-party advertising.',
        'We don’t record impressions or who viewed your profile. Creator insights count only interactions such as likes, comments, shares, saves, follows and story views.',
        'Photos you upload from the iPhone app are re-encoded so location and camera details stay on your device, unless you turn on “Keep original file data”.',
      ],
    },
    {
      heading: 'How we use it',
      paragraphs: [
        'To run Modula: showing your content to the audience you chose, delivering messages and notifications, and keeping your account secure.',
        'To send email you asked for, such as sign-in codes, security alerts and, if you turn them on, weekly or morning digests.',
        'To answer support requests and to investigate reports of abuse.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'Export: download a copy of your data from Settings → Data & Storage → Export.',
        'Delete: schedule deletion from Settings → Account → Delete Account. Deletion waits 7 days so you can change your mind; you can cancel any time before then.',
        'Notifications and digests: choose which notifications are created and whether digests are emailed from Settings → Notifications.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'We keep your information while your account is open. After deletion completes, your content and profile are removed. Records we must keep by law, such as payment records if payments are ever introduced, are kept only as long as required.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about privacy: ${LEGAL_CONTACT.privacy}. Everything else: ${LEGAL_CONTACT.support}.`],
    },
  ],
}

export const TERMS_DRAFT: LegalDocument = {
  id: 'terms',
  title: 'Terms of Service',
  status: 'DRAFT',
  lastUpdated: '2026-10-03',
  summary:
    'This is a draft of the terms for using Modula. It has not been reviewed by counsel and is not yet in effect.',
  sections: [
    {
      heading: 'Using Modula',
      paragraphs: [
        'You need an account to post, message or install modules. Keep your sign-in details secure; you’re responsible for activity on your account.',
        'Don’t use Modula to break the law, harass people, share content you don’t have the right to share, or interfere with the service.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'You own what you post. You give Modula permission to store, display and deliver it to the audience you choose, only as needed to run the service.',
        'You can delete your posts at any time, and you can delete your account with a 7-day grace period.',
      ],
    },
    {
      heading: 'Modules',
      paragraphs: [
        'Modules can be built by Modula or by others. A module only gets the permissions you grant when you install it, and you can remove it at any time.',
      ],
    },
    {
      heading: 'Payments',
      paragraphs: [
        'Modula does not take payments or pay creators today. If that changes, these terms will be updated before any charge or payout happens.',
      ],
    },
    {
      heading: 'Safety and enforcement',
      paragraphs: [
        'You can report posts and profiles from their menu. We may remove content or restrict accounts that break these terms, and we’ll tell you when we do unless the law or safety prevents it.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these terms: ${LEGAL_CONTACT.support}.`],
    },
  ],
}
