import React, { useState, useRef, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewMode = 'Day' | 'Week' | 'Month';

// ─── Constants ──────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 8;   // 8 AM
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // 8 AM – 8 PM

function hourLabel(h: number): string {
  if (h === 12) return '12 PM';
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

// ─── Styles (inline, matching mockup CSS) ───────────────────────────────────

const S = {
  // Shell
  view: {
    display: 'flex',
    flexDirection: 'row' as const,
    height: '100%',
    overflow: 'hidden',
    background: '#0f172a',
  },
  calShell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    position: 'relative' as const,
    background: '#0f172a',
    minWidth: 0,
  },

  // Nav bar
  calNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 20px',
    height: '44px',
    background: '#0d0d11',
    borderBottom: '1px solid rgba(241,245,249,0.14)',
    flexShrink: 0,
  },
  calNavLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  calMonthLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f1f5f9',
    whiteSpace: 'nowrap' as const,
    minWidth: '160px',
  },
  calArrowBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    background: 'transparent',
    border: '1px solid rgba(241,245,249,0.14)',
    color: '#94a3b8',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
  calTodayBtn: {
    padding: '5px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid rgba(241,245,249,0.14)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  calNavCenter: { flex: 1 },
  calViewToggle: {
    display: 'flex',
    gap: '2px',
    background: '#131d33',
    border: '1px solid rgba(241,245,249,0.14)',
    borderRadius: '7px',
    padding: '3px',
  },
  calViewBtnBase: {
    padding: '4px 12px',
    borderRadius: '5px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  calViewBtnActive: {
    background: 'rgba(241,245,249,0.14)',
    color: '#f1f5f9',
  },

  // Body
  calBody: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },

  // Agenda sidebar
  calAgenda: {
    width: '200px',
    minWidth: '200px',
    background: '#0e0e12',
    borderRight: '1px solid rgba(241,245,249,0.14)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflowY: 'auto' as const,
    flexShrink: 0,
    padding: '0 0 16px',
  },
  calAgendaSection: {
    padding: '14px 16px 8px',
  },
  calAgendaDayLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: '#94a3b8',
    marginBottom: '10px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(241,245,249,0.14)',
  },
  calAgendaItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '6px 0',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  calAgendaDotMeeting: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    marginTop: '5px',
    flexShrink: 0,
    background: '#a3862a',
  },
  calAgendaDotFocus: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    marginTop: '5px',
    flexShrink: 0,
    background: '#2ecc71',
  },
  calAgendaDotPersonal: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    marginTop: '5px',
    flexShrink: 0,
    background: '#666670',
  },
  calAgendaTime: {
    fontSize: '10px',
    color: '#94a3b8',
    whiteSpace: 'nowrap' as const,
    minWidth: '38px',
    marginTop: '2px',
  },
  calAgendaName: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.35,
    minWidth: 0,
  },
  calAgendaBadgeAda: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontSize: '9px',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 700,
    background: '#1f1f3d',
    color: '#8888ff',
    border: '1px solid #3d3d6a',
  },
  calAgendaBadgeKronos: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontSize: '9px',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 700,
    background: '#2a2010',
    color: '#a3862a',
    border: '1px solid #4a3a18',
  },

  // Week wrap
  calWeekWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minWidth: 0,
  },
  calDayHeaders: {
    display: 'grid',
    gridTemplateColumns: '48px repeat(7, 1fr)',
    borderBottom: '1px solid rgba(241,245,249,0.14)',
    flexShrink: 0,
    background: '#0d0d11',
  },
  calGutterSpacer: {
    borderRight: '1px solid rgba(241,245,249,0.14)',
  },
  calDayHeader: {
    padding: '8px 6px',
    textAlign: 'center' as const,
    borderRight: '1px solid rgba(241,245,249,0.14)',
    cursor: 'default',
  },
  calDayHeaderLast: {
    padding: '8px 6px',
    textAlign: 'center' as const,
    cursor: 'default',
  },
  calDayName: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: '#94a3b8',
    marginBottom: '3px',
  },
  calDayNameToday: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: '#a3862a',
    marginBottom: '3px',
  },
  calDayNum: {
    fontSize: '18px',
    fontWeight: 300,
    color: '#cbd5e1',
    lineHeight: 1,
  },
  calDayNumToday: {
    color: '#fff',
    background: '#a3862a',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 auto',
  },

  // Time grid
  calTimeGrid: {
    flex: 1,
    overflowY: 'auto' as const,
    position: 'relative' as const,
    paddingBottom: '60px',
  },
  calGridInner: {
    display: 'grid',
    gridTemplateColumns: '48px repeat(7, 1fr)',
    minHeight: '100%',
    position: 'relative' as const,
  },
  calTimeCol: {
    position: 'relative' as const,
    borderRight: '1px solid rgba(241,245,249,0.14)',
    minHeight: `${HOURS.length * HOUR_HEIGHT}px`,
  },
  calHourLabel: {
    position: 'absolute' as const,
    right: '6px',
    fontSize: '10px',
    color: 'rgba(148,163,184,0.5)',
    transform: 'translateY(-50%)',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },

  // Day columns
  calDayCol: {
    borderRight: '1px solid rgba(241,245,249,0.14)',
    position: 'relative' as const,
    minHeight: `${HOURS.length * HOUR_HEIGHT}px`,
  },
  calDayColToday: {
    borderRight: '1px solid rgba(241,245,249,0.14)',
    position: 'relative' as const,
    minHeight: `${HOURS.length * HOUR_HEIGHT}px`,
    background: 'rgba(232, 93, 58, 0.025)',
  },
  calDayColLast: {
    position: 'relative' as const,
    minHeight: `${HOURS.length * HOUR_HEIGHT}px`,
  },
  calHourLine: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: '1px',
    background: 'rgba(241,245,249,0.14)',
  },
  calHalfLine: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: '1px',
    background: 'rgba(255,255,255,0.03)',
    borderTop: '1px dashed rgba(255,255,255,0.04)',
  },
  calNowLine: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: '2px',
    background: '#a3862a',
    zIndex: 10,
    pointerEvents: 'none' as const,
  },

  // Events
  calEventMeeting: {
    position: 'absolute' as const,
    left: '3px',
    right: '3px',
    borderRadius: '5px',
    padding: '4px 7px',
    fontSize: '11px',
    lineHeight: 1.3,
    overflow: 'hidden',
    cursor: 'pointer',
    zIndex: 5,
    borderLeft: '3px solid #a3862a',
    background: 'rgba(232, 93, 58, 0.18)',
    color: '#ffb8a0',
  },
  calEventFocus: {
    position: 'absolute' as const,
    left: '3px',
    right: '3px',
    borderRadius: '5px',
    padding: '4px 7px',
    fontSize: '11px',
    lineHeight: 1.3,
    overflow: 'hidden',
    cursor: 'pointer',
    zIndex: 5,
    borderLeft: '3px solid #2ecc71',
    background: 'rgba(46, 204, 113, 0.12)',
    color: '#7de8a8',
  },
  calEventTravel: {
    position: 'absolute' as const,
    left: '3px',
    right: '3px',
    borderRadius: '5px',
    padding: '4px 7px',
    fontSize: '11px',
    lineHeight: 1.3,
    overflow: 'hidden',
    cursor: 'pointer',
    zIndex: 5,
    borderLeft: '3px solid #3b9ede',
    background: 'rgba(59, 158, 222, 0.14)',
    color: '#88c8f0',
  },
  calEventPersonal: {
    position: 'absolute' as const,
    left: '3px',
    right: '3px',
    borderRadius: '5px',
    padding: '4px 7px',
    fontSize: '11px',
    lineHeight: 1.3,
    overflow: 'hidden',
    cursor: 'pointer',
    zIndex: 5,
    borderLeft: '3px solid #666670',
    background: 'rgba(102, 102, 112, 0.18)',
    color: '#94a3b8',
  },
  calEventTitle: {
    fontWeight: 600,
    fontSize: '11px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  calEventTime: {
    fontSize: '10px',
    opacity: 0.75,
    marginTop: '1px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  calEventBadges: {
    display: 'flex',
    gap: '3px',
    marginTop: '3px',
    flexWrap: 'wrap' as const,
  },
  calEventBadgeAda: {
    fontSize: '8px',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: '3px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    background: '#1f1f3d',
    color: '#9999ff',
  },
  calEventBadgeKronos: {
    fontSize: '8px',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: '3px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    background: '#3d2010',
    color: '#e88060',
  },

  // Detail panel
  calDetailPanel: {
    position: 'absolute' as const,
    top: '44px',
    right: 0,
    bottom: '52px',
    width: '360px',
    background: '#131d33',
    borderLeft: '1px solid rgba(241,245,249,0.14)',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 30,
    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  calDetailHeader: {
    padding: '16px 18px 12px',
    borderBottom: '1px solid rgba(241,245,249,0.14)',
    flexShrink: 0,
  },
  calDetailClose: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    float: 'right' as const,
    marginTop: '-2px',
    fontFamily: 'inherit',
  },
  calDetailTypeDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#a3862a',
    marginRight: '6px',
    verticalAlign: 'middle',
  },
  calDetailTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#fff',
    margin: '6px 0 4px',
  },
  calDetailMeta: {
    fontSize: '12px',
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '3px',
  },
  calDetailMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  calDetailMetaIcon: { fontSize: '12px', width: '14px', textAlign: 'center' as const },
  calDetailBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  calDetailSectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  calDetailAttendees: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  calAttendee: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  calAttendeeAvatar: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  calAttendeeName: {
    fontSize: '12px',
    color: '#cbd5e1',
  },
  calAttendeeStatus: {
    marginLeft: 'auto',
    fontSize: '10px',
    color: '#2ecc71',
  },
  calAdaBrief: {
    background: '#12122a',
    border: '1px solid #2e2e5a',
    borderRadius: '8px',
    padding: '12px 14px',
  },
  calAdaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  calAdaAvatar: {
    width: '22px',
    height: '22px',
    borderRadius: '5px',
    background: '#1f1f4e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    flexShrink: 0,
  },
  calAdaLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8888cc',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  calAdaBriefItem: {
    fontSize: '12px',
    color: '#cbd5e1',
    padding: '4px 0 4px 12px',
    position: 'relative' as const,
    lineHeight: 1.45,
  },
  calDetailActions: {
    padding: '12px 18px',
    borderTop: '1px solid rgba(241,245,249,0.14)',
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },

  // Toast
  calToast: {
    position: 'absolute' as const,
    top: '52px',
    right: '16px',
    width: '340px',
    background: '#131d33',
    border: '1px solid rgba(241,245,249,0.14)',
    borderLeft: '3px solid #a3862a',
    borderRadius: '8px',
    padding: '12px 14px',
    zIndex: 30,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  toastIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
    background: '#3d1a08',
  },
  toastBody: { flex: 1 },
  toastAgent: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#a3862a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '3px',
  },
  toastText: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.4,
  },
  toastAction: {
    fontSize: '11px',
    color: '#a3862a',
    cursor: 'pointer',
    marginTop: '4px',
    display: 'inline-block',
  },
  toastDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0',
    fontFamily: 'inherit',
    flexShrink: 0,
  },

  // Agent overlay toolbar
  agentOverlayToolbar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '52px',
    background: 'rgba(13,13,17,0.96)',
    borderTop: '1px solid rgba(241,245,249,0.14)',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '0 16px',
    zIndex: 20,
    backdropFilter: 'blur(8px)',
    flexShrink: 0,
  },
  toolbarAgentIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  toolbarAgentAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    position: 'relative' as const,
    background: '#3d1a08',
  },
  toolbarStatusDot: {
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#2ecc71',
    border: '2px solid #0d0d11',
  },
  toolbarAgentName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f1f5f9',
    whiteSpace: 'nowrap' as const,
  },
  toolbarSeparator: {
    width: '1px',
    height: '24px',
    background: 'rgba(241,245,249,0.14)',
    flexShrink: 0,
  },
  toolbarSummary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#94a3b8',
    overflow: 'hidden',
  },
  toolbarSummaryHighlight: {
    color: '#e0c875',
    fontWeight: 500,
  },
  toolbarSummarySep: { color: 'rgba(148,163,184,0.4)' },
  toolbarActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  toolbarBtnPrimary: {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    background: '#a3862a',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  toolbarBtnSecondary: {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'rgba(241,245,249,0.08)',
    border: '1px solid rgba(241,245,249,0.14)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  toolbarBtnGhost: {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid rgba(241,245,249,0.1)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },

  // Right rail
  rightRail: {
    width: '280px',
    minWidth: '280px',
    background: '#0e0e12',
    borderLeft: '1px solid rgba(241,245,249,0.14)',
    display: 'flex',
    flexDirection: 'column' as const,
    flexShrink: 0,
    height: '100%',
    overflow: 'hidden',
  },
  railAgentTabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(241,245,249,0.14)',
    background: '#0d0d11',
    padding: '0 8px',
    gap: '2px',
  },
  railAgentTab: {
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#94a3b8',
    borderBottom: '2px solid transparent',
    position: 'relative' as const,
  },
  railAgentTabActive: {
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#f1f5f9',
    borderBottom: '2px solid #a3862a',
    position: 'relative' as const,
  },
  tabBadge: {
    position: 'absolute' as const,
    top: '4px',
    right: '2px',
    background: '#a3862a',
    color: '#fff',
    fontSize: '8px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '1px 4px',
    lineHeight: 1,
  },
  railHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid rgba(241,245,249,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  railAgentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  railAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    background: '#3d1a08',
  },
  railName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  railRole: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  railStatus: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#2ecc71',
    background: 'rgba(46,204,113,0.12)',
    padding: '3px 8px',
    borderRadius: '10px',
  },
  railChat: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  chatMsgHighlight: {
    background: 'rgba(163,134,42,0.1)',
    border: '1px solid rgba(163,134,42,0.25)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  chatMsgAgent: {
    background: 'rgba(241,245,249,0.04)',
    border: '1px solid rgba(241,245,249,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  msgLabel: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#a3862a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '5px',
  },
  chatActionRow: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  },
  chatBtnPrimary: {
    padding: '5px 10px',
    borderRadius: '5px',
    fontSize: '11px',
    fontWeight: 600,
    background: '#a3862a',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chatBtnSecondary: {
    padding: '5px 10px',
    borderRadius: '5px',
    fontSize: '11px',
    fontWeight: 500,
    background: 'rgba(241,245,249,0.08)',
    border: '1px solid rgba(241,245,249,0.12)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chatBtnOutline: {
    padding: '5px 10px',
    borderRadius: '5px',
    fontSize: '11px',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid rgba(241,245,249,0.14)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  msgTime: {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '5px',
  },
  railInput: {
    padding: '10px 12px',
    borderTop: '1px solid rgba(241,245,249,0.14)',
    flexShrink: 0,
  },
  railInputField: {
    width: '100%',
    background: 'rgba(241,245,249,0.06)',
    border: '1px solid rgba(241,245,249,0.12)',
    borderRadius: '7px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#f1f5f9',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  // Action buttons (detail panel)
  actionBtnPrimary: {
    padding: '7px 16px',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: 600,
    background: '#a3862a',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  actionBtnOutline: {
    padding: '7px 14px',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid rgba(241,245,249,0.2)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
} as const;

// ─── Sub-components (inlined) ────────────────────────────────────────────────

function AgendaSidebar({ onOpenDetail }: { onOpenDetail: () => void }) {
  return (
    <div style={S.calAgenda}>
      {/* Today */}
      <div style={S.calAgendaSection}>
        <div style={S.calAgendaDayLabel}>Today — Sun Mar 15</div>
        <div style={S.calAgendaItem} onClick={onOpenDetail}>
          <span style={S.calAgendaDotMeeting} />
          <span style={S.calAgendaTime}>10 AM</span>
          <span style={S.calAgendaName}>Investor Sync</span>
          <span style={S.calAgendaBadgeAda}>Ada</span>
        </div>
        <div style={S.calAgendaItem}>
          <span style={S.calAgendaDotFocus} />
          <span style={S.calAgendaTime}>1 PM</span>
          <span style={S.calAgendaName}>Focus: Dashboard Build</span>
        </div>
        <div style={S.calAgendaItem}>
          <span style={S.calAgendaDotMeeting} />
          <span style={S.calAgendaTime}>4:30 PM</span>
          <span style={S.calAgendaName}>VG Standup ⚠</span>
          <span style={S.calAgendaBadgeKronos}>K</span>
        </div>
      </div>
      {/* Tomorrow */}
      <div style={S.calAgendaSection}>
        <div style={S.calAgendaDayLabel}>Tomorrow — Mon Mar 16</div>
        <div style={S.calAgendaItem}>
          <span style={S.calAgendaDotMeeting} />
          <span style={S.calAgendaTime}>9 AM</span>
          <span style={S.calAgendaName}>Sprint Planning</span>
          <span style={S.calAgendaBadgeAda}>Ada</span>
        </div>
        <div style={S.calAgendaItem}>
          <span style={S.calAgendaDotMeeting} />
          <span style={S.calAgendaTime}>2 PM</span>
          <span style={S.calAgendaName}>Lynn Nelson — Buckner</span>
          <span style={S.calAgendaBadgeKronos}>K</span>
        </div>
      </div>
      {/* Tue Mar 17 */}
      <div style={S.calAgendaSection}>
        <div style={S.calAgendaDayLabel}>Tue Mar 17</div>
        <div style={S.calAgendaItem}>
          <span style={S.calAgendaDotPersonal} />
          <span style={S.calAgendaTime}>11 AM</span>
          <span style={S.calAgendaName}>Dentist</span>
        </div>
        <div style={S.calAgendaItem}>
          <span style={S.calAgendaDotMeeting} />
          <span style={S.calAgendaTime}>3 PM</span>
          <span style={S.calAgendaName}>All Hands</span>
          <span style={S.calAgendaBadgeAda}>Ada</span>
        </div>
      </div>
    </div>
  );
}

function CalNowDot() {
  return (
    <div
      style={{
        content: '',
        position: 'absolute',
        left: '-4px',
        top: '-4px',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: '#a3862a',
      }}
    />
  );
}

function HourLines() {
  return (
    <>
      {HOURS.map((h, i) => (
        <React.Fragment key={h}>
          <div style={{ ...S.calHourLine, top: `${i * HOUR_HEIGHT}px` }} />
          <div style={{ ...S.calHalfLine, top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
        </React.Fragment>
      ))}
    </>
  );
}

function CalEventBlock({
  style,
  type,
  title,
  time,
  badges,
  onClick,
}: {
  style: React.CSSProperties;
  type: 'meeting' | 'focus' | 'travel' | 'personal';
  title: string;
  time: string;
  badges?: { type: 'ada' | 'kronos'; label: string }[];
  onClick?: () => void;
}) {
  const baseStyle =
    type === 'meeting'
      ? S.calEventMeeting
      : type === 'focus'
        ? S.calEventFocus
        : type === 'travel'
          ? S.calEventTravel
          : S.calEventPersonal;

  return (
    <div style={{ ...baseStyle, ...style }} onClick={onClick}>
      <div style={S.calEventTitle}>{title}</div>
      <div style={S.calEventTime}>{time}</div>
      {badges && badges.length > 0 && (
        <div style={S.calEventBadges}>
          {badges.map((b, i) => (
            <span
              key={i}
              style={b.type === 'ada' ? S.calEventBadgeAda : S.calEventBadgeKronos}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      style={{
        ...S.calDetailPanel,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      <div style={S.calDetailHeader}>
        <button style={S.calDetailClose} onClick={onClose}>✕</button>
        <div>
          <span style={S.calDetailTypeDot} />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: '#a3862a',
            }}
          >
            Meeting · Zoom
          </span>
        </div>
        <div style={S.calDetailTitle}>Investor Sync</div>
        <div style={S.calDetailMeta}>
          <div style={S.calDetailMetaRow}>
            <span style={S.calDetailMetaIcon}>📅</span>
            <span>Sunday, March 15, 2026</span>
          </div>
          <div style={S.calDetailMetaRow}>
            <span style={S.calDetailMetaIcon}>🕐</span>
            <span>10:00 – 11:00 AM (1 hour)</span>
          </div>
          <div style={S.calDetailMetaRow}>
            <span style={S.calDetailMetaIcon}>🔗</span>
            <span style={{ color: '#3b9ede', cursor: 'pointer' }}>zoom.us/j/98412630011</span>
          </div>
        </div>
      </div>

      <div style={S.calDetailBody}>
        {/* Attendees */}
        <div>
          <div style={S.calDetailSectionLabel}>Attendees</div>
          <div style={S.calDetailAttendees}>
            <div style={S.calAttendee}>
              <div style={{ ...S.calAttendeeAvatar, background: '#1f2d5e' }}>CD</div>
              <span style={S.calAttendeeName}>
                Christian De Ramos{' '}
                <span style={{ color: '#94a3b8', fontSize: '10px' }}>(you)</span>
              </span>
              <span style={S.calAttendeeStatus}>✓ Accepted</span>
            </div>
            <div style={S.calAttendee}>
              <div style={{ ...S.calAttendeeAvatar, background: '#1f3d2d' }}>MC</div>
              <span style={S.calAttendeeName}>Marcus Chen · Sequoia</span>
              <span style={S.calAttendeeStatus}>✓ Accepted</span>
            </div>
            <div style={S.calAttendee}>
              <div style={{ ...S.calAttendeeAvatar, background: '#3d2d1f' }}>JR</div>
              <span style={S.calAttendeeName}>Jordan Reed · Partner</span>
              <span style={{ ...S.calAttendeeStatus, color: '#e0c875' }}>? Tentative</span>
            </div>
          </div>
        </div>

        {/* Ada's brief */}
        <div style={S.calAdaBrief}>
          <div style={S.calAdaHeader}>
            <div style={S.calAdaAvatar}>🔮</div>
            <span style={S.calAdaLabel}>Ada's Brief</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8' }}>
              Ready 8:42 AM
            </span>
          </div>
          {[
            'Marcus asked about Q4 ARR growth at last meeting — have slide 7 ready',
            'Series B timeline question expected — current guidance: H2 2026',
            'Jordan was skeptical of PrintDeed vertical — address proactively',
            <><strong style={{ color: '#f1f5f9' }}>Action from last:</strong> Send updated cap table by EOD Friday (not done)</>,
            'Tone: confident, data-forward, concise. Avoid over-promising.',
          ].map((item, i) => (
            <div key={i} style={S.calAdaBriefItem}>
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '10px',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#6666bb',
                  display: 'block',
                }}
              />
              {item}
            </div>
          ))}
        </div>

        {/* Kronos note */}
        <div
          style={{
            background: '#1a1208',
            border: '1px solid #3d2e10',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '5px',
                background: '#3d1a08',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
              }}
            >
              ⏳
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#cc8844',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Kronos — Schedule Note
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
            3 conflicts resolved this week. VG Standup and PrintDeed Review overlap at 4:30 today
            — awaiting your decision on which to move.
          </div>
        </div>
      </div>

      <div style={S.calDetailActions}>
        <button style={S.actionBtnPrimary}>🔗 Join Zoom</button>
        <button style={S.actionBtnOutline}>📅 Reschedule</button>
        <button style={S.actionBtnOutline}>📝 Add Notes</button>
      </div>
    </div>
  );
}

function KronosToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={S.calToast}>
      <div style={S.toastIcon}>⏳</div>
      <div style={S.toastBody}>
        <div style={S.toastAgent}>Kronos</div>
        <div style={S.toastText}>
          Lynn Nelson requested Tuesday 2pm — conflicts with Sprint Planning. Suggested
          alternatives sent.
        </div>
        <span style={S.toastAction}>View schedule →</span>
      </div>
      <button style={S.toastDismiss} onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}

function AgentOverlayToolbar({ onViewBrief }: { onViewBrief: () => void }) {
  return (
    <div style={S.agentOverlayToolbar}>
      <div style={S.toolbarAgentIdentity}>
        <div style={S.toolbarAgentAvatar}>
          ⏳
          <div style={S.toolbarStatusDot} />
        </div>
        <span style={S.toolbarAgentName}>Kronos ⏳</span>
      </div>
      <div style={S.toolbarSeparator} />
      <div style={S.toolbarSummary}>
        <span style={S.toolbarSummaryHighlight}>Next: Investor Sync in 2h</span>
        <span style={S.toolbarSummarySep}>·</span>
        <span>3 conflicts resolved</span>
        <span style={S.toolbarSummarySep}>·</span>
        <span style={S.toolbarSummaryHighlight}>Ada brief ready</span>
      </div>
      <div style={S.toolbarActions}>
        <button style={S.toolbarBtnPrimary} onClick={onViewBrief}>
          View Brief
        </button>
        <button style={S.toolbarBtnSecondary}>Scheduling</button>
        <button style={S.toolbarBtnGhost}>Pause Agent</button>
      </div>
    </div>
  );
}

function RightRail({ onViewBrief }: { onViewBrief: () => void }) {
  return (
    <div style={S.rightRail}>
      {/* Agent tabs */}
      <div style={S.railAgentTabs}>
        {[
          { icon: '🧠', active: false },
          { icon: '⏳', active: true, badge: '2' },
          { icon: '🔮', active: false },
          { icon: '🛡', active: false },
          { icon: '💡', active: false },
        ].map((t, i) => (
          <div key={i} style={t.active ? S.railAgentTabActive : S.railAgentTab}>
            {t.icon}
            {t.badge && <span style={S.tabBadge}>{t.badge}</span>}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={S.railHeader}>
        <div style={S.railAgentInfo}>
          <div style={S.railAvatar}>⏳</div>
          <div>
            <div style={S.railName}>Kronos</div>
            <div style={S.railRole}>Scheduling Agent</div>
          </div>
        </div>
        <div style={S.railStatus}>Active</div>
      </div>

      {/* Chat messages */}
      <div style={S.railChat}>
        <div style={S.chatMsgHighlight}>
          <div style={S.msgLabel}>⏳ Schedule Summary</div>
          3 meetings today (conflict at 4:30)
          <br />
          Ada brief ready for Investor Sync
          <br />
          Lynn Nelson Tuesday request — resolved
        </div>

        <div style={S.chatMsgAgent}>
          <strong>Kronos</strong>
          <br />
          Good morning! Your Investor Sync is at 10:00 AM — Ada's prep brief is ready. Key point:
          Marcus will likely ask about Q4 ARR and Series B timeline. Slide 7 is prepped.
          <div style={S.chatActionRow}>
            <button style={S.chatBtnPrimary} onClick={onViewBrief}>
              View Brief
            </button>
            <button style={S.chatBtnSecondary}>Join Zoom</button>
          </div>
          <div style={S.msgTime}>8:42 AM</div>
        </div>

        <div style={S.chatMsgAgent}>
          <strong>Kronos</strong>
          <br />
          ⚠️ Conflict detected: VG Standup and PrintDeed Review both at 4:30 PM today. Lynn Nelson
          requested Tuesday 2pm for Buckner review — but that conflicts with Sprint Planning. I've
          sent Lynn three alternative windows (Tue 10am, Wed 9am, Wed 2pm).
          <div style={S.chatActionRow}>
            <button style={S.chatBtnPrimary}>Resolve Conflicts</button>
            <button style={S.chatBtnSecondary}>Move VG</button>
          </div>
          <div style={S.msgTime}>8:45 AM</div>
        </div>

        <div style={S.chatMsgAgent}>
          <strong>Kronos</strong>
          <br />
          Thursday's Sequoia deep dive (10am) is confirmed — Ada brief will be ready by Wednesday
          evening. Jordan Reed is tentative; want me to send a nudge?
          <div style={S.chatActionRow}>
            <button style={S.chatBtnPrimary}>Send nudge</button>
            <button style={S.chatBtnOutline}>Ignore</button>
          </div>
          <div style={S.msgTime}>8:46 AM</div>
        </div>
      </div>

      {/* Input */}
      <div style={S.railInput}>
        <input
          type="text"
          placeholder="Message Kronos..."
          style={S.railInputField}
        />
      </div>
    </div>
  );
}

// ─── CalendarView ────────────────────────────────────────────────────────────

export function CalendarView() {
  const [detailOpen, setDetailOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);
  const [activeView] = useState<ViewMode>('Week');

  // Current time indicator position
  const nowTop = (() => {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    const offset = hours - START_HOUR;
    return offset * HOUR_HEIGHT;
  })();

  const openDetail = () => setDetailOpen(true);
  const closeDetail = () => setDetailOpen(false);

  const days = [
    { name: 'Sun', num: 15, today: true },
    { name: 'Mon', num: 16, today: false },
    { name: 'Tue', num: 17, today: false },
    { name: 'Wed', num: 18, today: false },
    { name: 'Thu', num: 19, today: false },
    { name: 'Fri', num: 20, today: false },
    { name: 'Sat', num: 21, today: false },
  ];

  return (
    <div style={S.view}>
      {/* ── Cal shell ── */}
      <div style={S.calShell}>

        {/* Top nav bar */}
        <div style={S.calNav}>
          <div style={S.calNavLeft}>
            <button style={S.calArrowBtn}>‹</button>
            <button style={S.calArrowBtn}>›</button>
            <span style={S.calMonthLabel}>March 2026</span>
            <button style={S.calTodayBtn}>Today</button>
          </div>
          <div style={S.calNavCenter} />
          <div style={S.calViewToggle}>
            {(['Day', 'Week', 'Month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                style={
                  v === activeView
                    ? { ...S.calViewBtnBase, ...S.calViewBtnActive }
                    : S.calViewBtnBase
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Body: agenda + week grid */}
        <div style={S.calBody}>

          {/* Agenda sidebar */}
          <AgendaSidebar onOpenDetail={openDetail} />

          {/* Week grid */}
          <div style={S.calWeekWrap}>

            {/* Day headers */}
            <div style={S.calDayHeaders}>
              <div style={S.calGutterSpacer} />
              {days.map((d, i) => (
                <div
                  key={d.num}
                  style={i === 6 ? S.calDayHeaderLast : S.calDayHeader}
                >
                  <div style={d.today ? S.calDayNameToday : S.calDayName}>{d.name}</div>
                  {d.today ? (
                    <div style={S.calDayNumToday}>{d.num}</div>
                  ) : (
                    <div style={S.calDayNum}>{d.num}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Scrollable time grid */}
            <div style={S.calTimeGrid}>
              <div style={S.calGridInner}>

                {/* Time gutter */}
                <div style={S.calTimeCol}>
                  {HOURS.map((h, i) => (
                    <div
                      key={h}
                      style={{ ...S.calHourLabel, top: `${i * HOUR_HEIGHT}px` }}
                    >
                      {hourLabel(h)}
                    </div>
                  ))}
                </div>

                {/* ── Sunday Mar 15 (TODAY) ── */}
                <div style={S.calDayColToday}>
                  <HourLines />
                  {/* Current time indicator */}
                  <div style={{ ...S.calNowLine, top: `${nowTop}px` }}>
                    <CalNowDot />
                  </div>
                  <CalEventBlock
                    style={{ top: '120px', height: '60px' }}
                    type="meeting"
                    title="Investor Sync"
                    time="10:00 – 11:00 AM"
                    badges={[{ type: 'ada', label: 'Ada Brief' }, { type: 'kronos', label: 'Prep' }]}
                    onClick={openDetail}
                  />
                  <CalEventBlock
                    style={{ top: '300px', height: '180px' }}
                    type="focus"
                    title="Focus: Dashboard Build"
                    time="1:00 – 4:00 PM"
                  />
                  <CalEventBlock
                    style={{ top: '510px', height: '30px' }}
                    type="meeting"
                    title="VG Standup ⚠"
                    time="4:30 PM"
                    badges={[{ type: 'kronos', label: 'Conflict' }]}
                  />
                  <CalEventBlock
                    style={{ top: '510px', height: '60px', left: '48%', right: '3px' }}
                    type="meeting"
                    title="PrintDeed Review"
                    time="4:30 – 5:30 PM"
                    badges={[{ type: 'kronos', label: 'Conflict' }]}
                  />
                </div>

                {/* ── Monday Mar 16 ── */}
                <div style={S.calDayCol}>
                  <HourLines />
                  <CalEventBlock
                    style={{ top: '60px', height: '60px' }}
                    type="meeting"
                    title="Sprint Planning"
                    time="9:00 – 10:00 AM"
                    badges={[{ type: 'ada', label: 'Ada Brief' }]}
                  />
                  <CalEventBlock
                    style={{ top: '360px', height: '60px' }}
                    type="meeting"
                    title="Lynn Nelson — Buckner"
                    time="2:00 – 3:00 PM"
                    badges={[{ type: 'kronos', label: 'Prep' }]}
                  />
                  <CalEventBlock
                    style={{ top: '480px', height: '30px' }}
                    type="travel"
                    title="✈ Travel: Austin → DAL"
                    time="4:00 PM"
                  />
                </div>

                {/* ── Tuesday Mar 17 ── */}
                <div style={S.calDayCol}>
                  <HourLines />
                  <CalEventBlock
                    style={{ top: '180px', height: '60px' }}
                    type="personal"
                    title="Dentist Appt"
                    time="11:00 AM – 12:00 PM"
                  />
                  <CalEventBlock
                    style={{ top: '420px', height: '60px' }}
                    type="meeting"
                    title="All Hands"
                    time="3:00 – 4:00 PM"
                    badges={[{ type: 'ada', label: 'Ada Brief' }]}
                  />
                </div>

                {/* ── Wednesday Mar 18 ── */}
                <div style={S.calDayCol}>
                  <HourLines />
                  <CalEventBlock
                    style={{ top: '0px', height: '90px' }}
                    type="focus"
                    title="Focus: API Review"
                    time="8:00 – 9:30 AM"
                  />
                  <CalEventBlock
                    style={{ top: '210px', height: '60px' }}
                    type="meeting"
                    title="1:1 with Vulcan"
                    time="11:30 AM – 12:30 PM"
                  />
                  <CalEventBlock
                    style={{ top: '390px', height: '30px' }}
                    type="meeting"
                    title="Design Review"
                    time="2:30 PM"
                  />
                </div>

                {/* ── Thursday Mar 19 ── */}
                <div style={S.calDayCol}>
                  <HourLines />
                  <CalEventBlock
                    style={{ top: '120px', height: '90px' }}
                    type="meeting"
                    title="Sequoia — Series A Deep Dive"
                    time="10:00 – 11:30 AM"
                    badges={[{ type: 'ada', label: 'Ada Brief' }, { type: 'kronos', label: 'Prep' }]}
                  />
                  <CalEventBlock
                    style={{ top: '360px', height: '120px' }}
                    type="focus"
                    title="Focus: Q2 Planning"
                    time="2:00 – 4:00 PM"
                  />
                </div>

                {/* ── Friday Mar 20 ── */}
                <div style={S.calDayCol}>
                  <HourLines />
                  <CalEventBlock
                    style={{ top: '30px', height: '30px' }}
                    type="meeting"
                    title="Engineering Standup"
                    time="8:30 AM"
                  />
                  <CalEventBlock
                    style={{ top: '300px', height: '60px' }}
                    type="meeting"
                    title="Investor Relations Update"
                    time="1:00 – 2:00 PM"
                    badges={[{ type: 'ada', label: 'Ada Brief' }]}
                  />
                  <CalEventBlock
                    style={{ top: '480px', height: '60px' }}
                    type="personal"
                    title="🌺 Bella: Cheer Practice Pickup"
                    time="4:00 – 5:00 PM"
                  />
                </div>

                {/* ── Saturday Mar 21 ── */}
                <div style={{ ...S.calDayColLast }}>
                  <HourLines />
                  <CalEventBlock
                    style={{ top: '120px', height: '180px' }}
                    type="personal"
                    title="Family Day 🏠"
                    time="10:00 AM – 1:00 PM"
                  />
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Meeting detail panel */}
        <DetailPanel open={detailOpen} onClose={closeDetail} />

        {/* Scheduling suggestion toast */}
        {toastVisible && <KronosToast onDismiss={() => setToastVisible(false)} />}

        {/* Kronos agent overlay toolbar */}
        <AgentOverlayToolbar onViewBrief={openDetail} />

      </div>

      {/* Right Rail */}
      <RightRail onViewBrief={openDetail} />
    </div>
  );
}
