// Mock data for the Comms view

export type ChannelType = 'email' | 'imessage' | 'slack' | 'social' | 'phone';

export type AgentBadge = 'triaged' | 'draft' | 'flagged' | 'archived';

export interface Message {
  id: string;
  channel: ChannelType;
  sender: string;
  senderAvatar?: string;
  senderInitials: string;
  subject?: string;
  snippet: string;
  body?: string;
  timestamp: string;
  isUnread: boolean;
  agentBadge?: AgentBadge;
  isStarred?: boolean;
}

export interface IMessage {
  id: string;
  fromMe: boolean;
  content: string;
  timestamp: string;
}

export interface Voicemail {
  id: string;
  caller: string;
  callerInitials: string;
  duration: number; // seconds
  timestamp: string;
  transcript: string;
}

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    channel: 'email',
    sender: 'Sarah Chen',
    senderInitials: 'SC',
    subject: 'Q1 Design Review — Feedback Needed',
    snippet: 'Hi team, I\'ve finished the initial design pass for the dashboard. Would love your thoughts on the...',
    body: `Hi team,

I've finished the initial design pass for the Q1 dashboard. Would love your thoughts on the color system and the new card components before we move to implementation.

Key things to review:
1. Color palette — moved to a warmer accent set
2. Card density — reduced padding by 4px globally
3. Navigation rail — added hover states and active indicators

The Figma link is in the thread. Let me know if you have questions!

Best,
Sarah`,
    timestamp: '10:42 AM',
    isUnread: true,
    agentBadge: 'triaged',
  },
  {
    id: 'msg-2',
    channel: 'slack',
    sender: 'Marcus Webb',
    senderInitials: 'MW',
    subject: '#engineering — deploy pipeline',
    snippet: 'Just pushed a fix for the flaky CI step. Should be green now. Kick off a new build when you get a chance...',
    timestamp: '9:58 AM',
    isUnread: true,
    agentBadge: 'flagged',
  },
  {
    id: 'msg-3',
    channel: 'imessage',
    sender: 'Jordan Lee',
    senderInitials: 'JL',
    snippet: 'Hey! Are we still on for the sync at 3pm? I might be 5 mins late coming from another call.',
    timestamp: '9:31 AM',
    isUnread: false,
    agentBadge: 'draft',
  },
  {
    id: 'msg-4',
    channel: 'email',
    sender: 'Product Hunt',
    senderInitials: 'PH',
    subject: 'Your product is trending 🚀',
    snippet: 'Aegilume just hit #3 on Product Hunt. Here\'s a summary of your metrics and community engagement...',
    timestamp: 'Yesterday',
    isUnread: false,
    agentBadge: 'archived',
  },
  {
    id: 'msg-5',
    channel: 'phone',
    sender: 'Alex Rivera',
    senderInitials: 'AR',
    snippet: 'Voicemail — 1:24 · "Hey, just calling about the contract renewal. Give me a ring when you..."',
    timestamp: 'Yesterday',
    isUnread: true,
  },
  {
    id: 'msg-6',
    channel: 'email',
    sender: 'GitHub',
    senderInitials: 'GH',
    subject: '[aegilume/shell] PR #142 — Add Comms view',
    snippet: 'worker-3 opened a pull request: Add unified Comms view with 8 components. Review requested from...',
    timestamp: 'Mon',
    isUnread: false,
    agentBadge: 'triaged',
  },
  {
    id: 'msg-7',
    channel: 'social',
    sender: 'Twitter / X',
    senderInitials: 'TW',
    subject: '3 new mentions',
    snippet: '@aegilume_ai Love the new interface! The agent overlay is super clean. Looking forward to the public launch...',
    timestamp: 'Mon',
    isUnread: false,
  },
  {
    id: 'msg-8',
    channel: 'slack',
    sender: 'Priya Nair',
    senderInitials: 'PN',
    subject: '#design — brand refresh',
    snippet: 'Updated the Figma library with the new token set. All components are auto-updated. Check the changelogs in the description.',
    timestamp: 'Sun',
    isUnread: false,
  },
];

export const MOCK_IMESSAGES: IMessage[] = [
  {
    id: 'im-1',
    fromMe: false,
    content: 'Hey! Just finished reviewing the mockups you sent over.',
    timestamp: '9:15 AM',
  },
  {
    id: 'im-2',
    fromMe: true,
    content: 'Oh great! What do you think? Any major changes needed?',
    timestamp: '9:17 AM',
  },
  {
    id: 'im-3',
    fromMe: false,
    content: 'Overall looks really solid. The agent overlay is my favorite part. Maybe tweak the sidebar width slightly?',
    timestamp: '9:22 AM',
  },
  {
    id: 'im-4',
    fromMe: true,
    content: 'Good call — I was thinking the same. Will adjust to 200px and see how it feels.',
    timestamp: '9:25 AM',
  },
  {
    id: 'im-5',
    fromMe: false,
    content: 'Hey! Are we still on for the sync at 3pm? I might be 5 mins late coming from another call.',
    timestamp: '9:31 AM',
  },
];

export const MOCK_VOICEMAIL: Voicemail = {
  id: 'vm-1',
  caller: 'Alex Rivera',
  callerInitials: 'AR',
  duration: 84,
  timestamp: 'Yesterday, 4:17 PM',
  transcript: '"Hey, just calling about the contract renewal. Give me a ring when you get a chance — I\'m free most of tomorrow morning. Nothing urgent, just want to make sure we\'re aligned before the end of Q1. Talk soon."',
};
