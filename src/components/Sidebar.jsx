import {
  LayoutDashboard,
  FileCode2,
  History,
  GraduationCap,
  Settings,
  PanelLeftClose,
  ChevronRight,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "New Review", icon: FileCode2 },
  { label: "My Reviews", icon: History },
  { label: "Learning Hub", icon: GraduationCap },
  { label: "My Profile", icon: UserRound, authenticatedOnly: true },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage = "Dashboard",
  onNavigate = () => {},
  onHide = () => {},
  hidden = false,
  authUser = null,
  onLogin = () => {},
  onLogout = () => {},
}) {
  if (hidden) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand-row">
        <div className="logo-icon" aria-hidden="true">
          <img src="/KLYRO_LOGO.png" alt="" />
        </div>
        <span className="logo-text">KLYRO</span>
        <button
          type="button"
          className="sidebar-hide-button"
          onClick={onHide}
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigationItems.filter((item) => !item.authenticatedOnly || authUser).map(({ label, icon: Icon }) => {
          const isActive = activePage === label;

          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
              aria-current={isActive ? "page" : undefined}
              className={`nav-item ${isActive ? "active" : ""}`}
              title={label}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              <span>{label}</span>
              {isActive && <ChevronRight className="nav-chevron" size={16} />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <button type="button" className="sidebar-auth-button" title={authUser ? "Sign out" : "Log in"} aria-label={authUser ? "Sign out" : "Log in"} onClick={authUser ? onLogout : onLogin}>
          {authUser ? <LogOut size={15} /> : <LogIn size={15} />}
          <span>{authUser ? "Sign out" : "Log in"}</span>
        </button>
      </div>
    </aside>
  );
}
