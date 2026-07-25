import { Brain, Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button } from './Button';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { logout, isAuthenticated } = useAuthStore();
  const isLoggedIn = isAuthenticated || location.pathname.includes('/dashboard') || location.pathname.includes('/interview') || location.pathname.includes('/admin');

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const navItems = isLoggedIn ? [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Resume', path: '/resume' },
    { name: 'History', path: '/history' },
    { name: 'Pricing', path: '/subscription' },
  ] : [
    { name: 'Features', path: '#features' },
    { name: 'How it Works', path: '#how-it-works' },
    { name: 'Pricing', path: '#pricing' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-primary rounded-lg transition-all">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">Smart Interview AI</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.path}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link to="/profile">
                  <Button variant="ghost" size="sm">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="primary" size="sm">
                    Start Free
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.path}
                className="block text-muted-foreground hover:text-foreground transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              {isLoggedIn ? (
                <>
                  <Link to="/profile">
                    <Button variant="ghost" className="w-full">
                      Profile
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button variant="primary" className="w-full">
                      Start Free
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}