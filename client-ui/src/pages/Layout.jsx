import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import SearchModal from '../components/SearchModal';
import NotificationsPanel from '../components/NotificationsPanel';
import OfflineBanner from '../components/OfflineBanner';
import useSyncEngine from '../hooks/useSyncEngine';
import { useNotifications } from '../contexts/NotificationsContext';
import { deriveAnalytics } from '../data/examBank';
import { describeRemaining } from '../lib/sessionPolicy';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { user } = useUser();
  const { logOut, sessionDeadline, sessionDays, user: authUser } = useAuth();
  // Drains the durable queue of writes taken while offline. Mounted here so it
  // runs for the whole authenticated app rather than per page.
  const { pending: pendingSyncCount } = useSyncEngine(authUser?.id);
  const { unreadCount, markAllRead, refresh: refreshNotifs } = useNotifications();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const bellRef = useRef(null);

  // The session window is a week, so students need to be able to end it early
  // on a shared or public machine. logOut had no call site at all before this.
  const handleSignOut = async () => {
    setIsSigningOut(true);
    await logOut();
    navigate('/login', { replace: true });
  };

  // Live streak from real exam attempts. Recompute on every route change so
  // returning from an exam shows the new streak immediately.
  const streak = useMemo(() => deriveAnalytics({ days: null }).streak, [location.pathname]);

  // ── Auto-hide bottom nav on scroll ──────────────────────────────────────────
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    // We watch the main scroll container, not window, since overflow is on the inner div
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentY = container.scrollTop;
      const delta = currentY - lastScrollY.current;

      if (delta > 6 && currentY > 40) {
        // Scrolling down — hide nav
        setNavVisible(false);
      } else if (delta < -6) {
        // Scrolling up — show nav
        setNavVisible(true);
      }

      lastScrollY.current = currentY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Always show nav on route change; also refresh notifications
  useEffect(() => {
    setNavVisible(true);
    lastScrollY.current = 0;
    setIsNotifOpen(false);
    refreshNotifs();
  }, [location.pathname, refreshNotifs]);

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: 'solar:home-2-linear' },
    { name: t('nav.practice'), path: '/practice', icon: 'solar:book-bookmark-linear' },
    { name: t('nav.syllabus'), path: '/syllabus', icon: 'solar:layers-linear' },
    { name: t('nav.analytics'), path: '/analytics', icon: 'solar:chart-square-linear' },
    { name: t('nav.mockExams'), path: '/mock-exams', icon: 'solar:target-linear' },
  ];

  return (
    <div className="antialiased h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row bg-[#0B1120]">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-full border-r border-white/5 bg-gradient-to-b from-[#0B1120] to-[#0D0F1B] flex-col flex-shrink-0 z-20">
        {/* Logo */}
        <div className="h-20 px-6 flex items-center border-b border-white/5">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg  bg-white flex items-center justify-center text-white transition-all group-hover:scale-110">
              <Icon icon="lucide:graduation-cap" width="24" height="24" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">EduPractice</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group font-medium ${
 isActive
 ? 'bg-[#f99c00]/15 text-[#f99c00] '
 : 'text-slate-400 hover:text-white hover:bg-white/5'
 }`}
              >
                <Icon
                  icon={item.icon}
                  width="24" height="24"
                  className={isActive ? '' : 'group-hover:text-white transition-colors'}
                  style={{ strokeWidth: 1 }}
                />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-6 pb-2 px-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('sidebar.subjects')}</p>
          </div>
          <Link to="/practice?subject=physics" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all group font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span className="text-sm">{t('subjects.physics')}</span>
          </Link>
          <Link to="/practice?subject=mathematics" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all group font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
            <span className="text-sm">{t('subjects.mathematics')}</span>
          </Link>
        </nav>

        {/* Bottom User Profile */}
        <div className="p-4 border-t border-white/5">
          <Link to="/profile" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all group">
            <Avatar name={user.fullName} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.fullName}</p>
              <p className="text-xs text-slate-500 truncate">{t('sidebar.freeplan')}</p>
            </div>
            <Icon icon="solar:alt-arrow-right-linear" width="20" height="20" className="text-slate-500 group-hover:text-[#f99c00] transition-colors" style={{ strokeWidth: 1 }} />
          </Link>
          <SessionFooter onSignOut={handleSignOut} isSigningOut={isSigningOut} sessionDeadline={sessionDeadline} sessionDays={sessionDays} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#0B1120]">
        {/* Background Glow */}
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[#f99c00]/3 rounded-full blur-[150px] pointer-events-none z-0 opacity-40"></div>

        {/* Top Header */}
        {/* z-30, above the content column's z-10: the notification panel is
            absolutely positioned inside this header, and `backdrop-blur-lg`
            makes the header its own stacking context. The panel's own z-[200]
            can only compete inside that context, so if the header is not above
            the content column the panel renders *behind* the page. Equal z-index
            would not do it either — the content column comes later in the DOM
            and would win the tie. */}
        <header className="h-16 md:h-20 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-[#0B1120] to-[#0D0F1B] backdrop-blur-lg z-30 shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <Icon icon={isMobileSidebarOpen ? "solar:close-circle-linear" : "solar:hamburger-menu-linear"} width="24" style={{ strokeWidth: 1 }} />
            </button>
          </div>

          <button 
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-3 w-96 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] rounded-lg px-4 py-2.5 text-sm text-slate-500 transition-all group"
          >
            <Icon icon="solar:magnifier-linear" width="20" height="20" className="text-slate-400 group-hover:text-slate-300" style={{ strokeWidth: 1 }} />
            <span className="flex-1 text-left">Search topics, questions...</span>
            <div className="flex items-center gap-1">
              <kbd className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded px-2 py-1">⌘</kbd>
              <kbd className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded px-2 py-1">K</kbd>
            </div>
          </button>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-[#111827]/80 hover:border-[#f99c00]/30 transition-all">
              <Icon icon="solar:fire-linear" width="18" height="18" className="text-[#f99c00]" style={{ strokeWidth: 1 }} />
              <span className="text-xs md:text-sm font-bold text-slate-300">{streak}<span className="hidden sm:inline"> {streak === 1 ? 'Day' : 'Days'}</span></span>
            </div>

            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setIsNotifOpen(v => !v)}
                className={`relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors ${isNotifOpen ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white'}`}
                aria-label="Notifications"
              >
                <Icon icon={isNotifOpen ? 'solar:bell-bold' : 'solar:bell-linear'} width="24" height="24" style={{ strokeWidth: 1 }} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-[#f99c00] border border-[#0B1120] flex items-center justify-center">
                    <span className="text-[9px] font-bold text-black px-0.5">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  </span>
                )}
              </button>

              <NotificationsPanel
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
              />
            </div>

            <button
              onClick={() => navigate('/profile')}
              className="hidden md:flex w-11 h-11 items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              aria-label="Settings"
              title="Profile & Settings"
            >
              <Icon icon="solar:settings-linear" width="24" height="24" style={{ strokeWidth: 1 }} />
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              aria-label="Search"
            >
              <Icon icon="solar:magnifier-linear" width="22" height="22" style={{ strokeWidth: 1 }} />
            </button>
          </div>
        </header>

        {/* Dynamic Route Content — scroll container ref lives here */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden z-10 flex flex-col relative"
        >
          <OfflineBanner pendingSyncCount={pendingSyncCount} />
          <Outlet />

          {/* Spacer keeps content clear of the fixed bottom nav on mobile */}
          <div className="md:hidden h-[72px] shrink-0" />
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`md:hidden fixed top-0 left-0 w-64 h-[100dvh] pb-[60px] bg-gradient-to-b from-[#0B1120] to-[#0D0F1B] border-r border-white/5 flex flex-col z-40 transform transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`}>
        <div className="h-20 px-6 flex items-center border-b border-white/5 sticky top-0 bg-[#0B1120]/95 backdrop-blur">
          <Link to="/" className="flex items-center gap-3 group w-full" onClick={() => setIsMobileSidebarOpen(false)}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center transition-all group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B1120" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
                <path d="M22 10v6"/>
                <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">EduPractice</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group font-medium ${
 isActive
 ? 'bg-[#f99c00]/15 text-[#f99c00] '
 : 'text-slate-400 hover:text-white hover:bg-white/5'
 }`}
              >
                <Icon
                  icon={item.icon}
                  width="24" height="24"
                  className={isActive ? '' : 'group-hover:text-white transition-colors'}
                  style={{ strokeWidth: 1 }}
                />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-6 pb-2 px-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('sidebar.subjects')}</p>
          </div>
          <Link to="/practice?subject=physics" onClick={() => setIsMobileSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all group font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span className="text-sm">{t('subjects.physics')}</span>
          </Link>
          <Link to="/practice?subject=mathematics" onClick={() => setIsMobileSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all group font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
            <span className="text-sm">{t('subjects.mathematics')}</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-white/5 sticky bottom-0 bg-[#0B1120]/95 backdrop-blur">
          <Link to="/profile" onClick={() => setIsMobileSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all group">
            <Avatar name={user.fullName} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.fullName}</p>
              <p className="text-xs text-slate-500 truncate">{t('sidebar.freeplan')}</p>
            </div>
            <Icon icon="solar:alt-arrow-right-linear" width="20" height="20" className="text-slate-500 group-hover:text-[#f99c00] transition-colors" style={{ strokeWidth: 1 }} />
          </Link>
          <SessionFooter onSignOut={handleSignOut} isSigningOut={isSigningOut} sessionDeadline={sessionDeadline} sessionDays={sessionDays} />
        </div>
      </aside>

      {/* ── Mobile Bottom Nav — auto-hide on scroll down ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-[#0B1120] via-[#0B1120] to-[#0B1120]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 z-50"
        style={{
          transform: navVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center flex-1 min-w-0 h-full transition-all ${
 isActive ? 'text-[#f99c00]' : 'text-slate-500 hover:text-white'
 }`}
              aria-label={item.name}
            >
              <Icon icon={item.icon} width="24" height="24" style={{ strokeWidth: 1.5 }} />
            </Link>
          );
        })}
        <Link
          to="/profile"
          className={`flex items-center justify-center flex-1 min-w-0 h-full transition-all ${
 location.pathname === '/profile' ? 'text-[#f99c00]' : 'text-slate-500 hover:text-white'
 }`}
          aria-label="Profile"
        >
          <Icon icon="solar:user-circle-linear" width="24" height="24" style={{ strokeWidth: 1.5 }} />
        </Link>
      </nav>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}

// Sign-out plus a note of how long the session has left. Rendered in both
// sidebars; the component exists once because the wording and the week-long
// policy should not drift between desktop and mobile.
function SessionFooter({ onSignOut, isSigningOut, sessionDeadline, sessionDays }) {
  // Derived from the deadline on every render rather than stored as a countdown,
  // so the chip cannot go stale while the student is reading it.
  const remaining = sessionDeadline ? describeRemaining(sessionDeadline - Date.now()) : null;
  return (
    <div className="mt-2 px-3 pt-3 border-t border-white/5">
      {remaining && (
        <p className="mb-2 text-[11px] text-slate-500 leading-snug">
          <Icon icon="solar:clock-circle-linear" width="12" height="12" className="inline mr-1 -mt-0.5" style={{ strokeWidth: 1.5 }} />
          {remaining} · {sessionDays}-day session
        </p>
      )}
      <button
        type="button"
        onClick={onSignOut}
        disabled={isSigningOut}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon
          icon={isSigningOut ? 'solar:restart-linear' : 'solar:logout-square-linear'}
          width="16" height="16"
          style={{ strokeWidth: 1.5 }}
          className={isSigningOut ? 'animate-spin' : ''}
        />
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
