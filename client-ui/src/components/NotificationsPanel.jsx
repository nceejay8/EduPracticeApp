import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useNotifications } from '../contexts/NotificationsContext';

export default function NotificationsPanel({ isOpen, onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const todayItems  = notifications.filter(n => n.today);
  const earlierItems = notifications.filter(n => !n.today);

  return (
    // Height is capped against the viewport rather than the parent, and the
    // header is pinned while the list scrolls. The earlier version subtracted a
    // hardcoded 52px to get the list height, which silently broke whenever the
    // header grew. The cap also clears the fixed bottom nav on mobile — the
    // previous `100dvh - 80px` ran the list underneath it.
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-[#0f1219] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 z-[200] flex flex-col overflow-hidden"
      style={{ maxHeight: 'min(560px, calc(100dvh - 9rem))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/25">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-all"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-400 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-all"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
        {notifications.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Icon icon="solar:bell-off-bold" width="32" className="text-slate-700 mx-auto" />
            <p className="text-sm text-slate-600">No notifications yet</p>
          </div>
        ) : (
          <>
            {todayItems.length > 0 && (
              <Section label="Today" items={todayItems} markRead={markRead} onClose={onClose} />
            )}
            {earlierItems.length > 0 && (
              <Section label="Earlier" items={earlierItems} markRead={markRead} onClose={onClose} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, items, markRead, onClose }) {
  return (
    <div>
      <div className="px-4 pt-3.5 pb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {items.map(n => (
          <NotifRow key={n.id} n={n} markRead={markRead} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

function NotifRow({ n, markRead, onClose }) {
  const handleClick = () => {
    markRead(n.id);
    onClose();
  };

  const inner = (
    <div
      className={`flex gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer relative ${
        !n.isRead ? 'bg-white/[0.02]' : ''
      }`}
      onClick={!n.cta ? () => markRead(n.id) : undefined}
    >
      {/* Unread dot */}
      {!n.isRead && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}

      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 rounded-xl ${n.iconBg} flex items-center justify-center mt-0.5`}>
        <Icon icon={n.icon} width="18" className={n.iconColor} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug mb-0.5 ${n.isRead ? 'text-slate-300' : 'text-white'}`}>
          {n.title}
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">{n.body}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-slate-600">{n.timeAgo}</span>
          {n.cta && (
            <span className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
              {n.cta.label} →
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (n.cta) {
    return (
      <Link to={n.cta.path} onClick={handleClick} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
