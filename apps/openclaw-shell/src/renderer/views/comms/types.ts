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
