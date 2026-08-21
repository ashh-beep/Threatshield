import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { classNames } from '@utils/helpers';
import { useAuth } from '@context/AuthContext';

interface NavbarProps {
  currentSection?: string;
  onNavigate?: (section: string) => void;
}

const navItems = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'how-it-works', label: 'How It Works', href: '#how-it-works' },
  { id: 'detection', label: 'Detection', href: '#detection' },
  { id: 'security', label: 'Security', href: '#security' },
  { id: 'about', label: 'About', href: '#about' },
];

export function Navbar({ currentSection, onNavigate }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isSuperAdmin, isOrgAdmin, user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (isUserMenuOpen) setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, isUserMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen, isUserMenuOpen]);

  const handleNavClick = (section: string) => {
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(section);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    navigate('/');
  };

  const getDashboardPath = () => {
    if (isSuperAdmin) return '/threatshield-admin';
    if (isOrgAdmin) return '/org-admin';
    return '/dashboard';
  };

  return (
    <nav
      className={classNames(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        isScrolled
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm'
          : 'bg-transparent'
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2" aria-label="Gatekeeper">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center" aria-hidden="true">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-gray-100">Gatekeeper</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={classNames(
                  'text-sm font-medium transition-colors duration-200 relative py-2',
                  currentSection === item.id
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                )}
                aria-current={currentSection === item.id ? 'page' : undefined}
              >
                {item.label}
                {currentSection === item.id && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full" aria-hidden="true" />
                )}
              </button>
            ))}

            {!isAuthenticated ? (
              <>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to={getDashboardPath()}>
                  <Button variant="primary" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Link to="/dashboard" className="hidden sm:inline-flex">
                  <Button variant="outline" size="sm">
                    New Scan
                  </Button>
                </Link>
                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                    aria-label="User menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user?.first_name || user?.email}
                    </span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-slide-down z-50"
                      role="menu"
                    >
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user?.first_name} {user?.last_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.email}
                        </p>
                        <Badge 
                          variant={isSuperAdmin ? 'danger' : isOrgAdmin ? 'warning' : 'info'} 
                          size="sm" 
                          dot 
                          className="mt-1"
                        >
                          {isSuperAdmin ? 'Super Admin' : isOrgAdmin ? 'Org Admin' : 'User'}
                        </Badge>
                      </div>
                      
                      <Link to={getDashboardPath()} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" onClick={() => setIsUserMenuOpen(false)}>
                        Dashboard
                      </Link>
                      <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" onClick={() => setIsUserMenuOpen(false)}>
                        Profile & Settings
                      </Link>
                      {isSuperAdmin && (
                        <Link to="/threatshield-admin" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" onClick={() => setIsUserMenuOpen(false)}>
                          ThreatShield Admin
                        </Link>
                      )}
                      {isOrgAdmin && (
                        <Link to="/org-admin" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" onClick={() => setIsUserMenuOpen(false)}>
                          Organization Admin
                        </Link>
                      )}
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            id="mobile-menu"
            className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700 animate-slide-down"
            role="menu"
          >
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  role="menuitem"
                  className={classNames(
                    'px-4 py-3 rounded-lg text-left font-medium transition-colors',
                    currentSection === item.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  aria-current={currentSection === item.id ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ))}
              {!isAuthenticated ? (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                  <Link to="/register">
                    <Button variant="primary" className="w-full">
                      Get Started
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      Login
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                  <Link to={getDashboardPath()} onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="primary" className="w-full">
                      Dashboard
                    </Button>
                  </Link>
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">
                      Profile & Settings
                    </Button>
                  </Link>
                  {isSuperAdmin && (
                    <Link to="/threatshield-admin" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        ThreatShield Admin
                      </Button>
                    </Link>
                  )}
{isOrgAdmin && (
                     <Link to="/org-admin" onClick={() => setIsMobileMenuOpen(false)}>
                       <Button variant="outline" className="w-full">
                         Organization Admin
                       </Button>
                     </Link>
                   )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    role="menuitem"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}