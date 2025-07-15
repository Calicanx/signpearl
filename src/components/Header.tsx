import React from 'react';
import { FileText, Menu, X } from 'lucide-react';
import { Page, AuthUser } from '../types';

interface HeaderProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  isAuthenticated: boolean;
  user?: AuthUser | null;
  onSignOut?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onPageChange, isAuthenticated, user, onSignOut }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <button
              onClick={() => onPageChange('landing')}
              className="flex items-center space-x-2 text-2xl font-bold text-white hover:text-blue-200 transition-colors"
            >
              <FileText className="w-8 h-8 text-blue-300" />
              <span>SignPearl</span>
            </button>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            {!isAuthenticated ? (
              <>
                <a href="#features" className="text-white/80 hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="text-white/80 hover:text-white transition-colors">Pricing</a>
                <button
                  onClick={() => onPageChange('signin')}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onPageChange('signup')}
                  className="bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-lg hover:bg-white/30 transition-colors border border-white/30"
                >
                  Get Started
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onPageChange('dashboard')}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  Dashboard
                </button>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-medium border border-white/30">
                    {user?.name?.charAt(0)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white">{user?.name}</span>
                    {onSignOut && (
                      <button
                        onClick={onSignOut}
                        className="text-white/80 hover:text-white text-sm transition-colors"
                      >
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </nav>

          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col space-y-4">
              {!isAuthenticated ? (
                <>
                  <a href="#features" className="text-white/80 hover:text-white transition-colors">Features</a>
                  <a href="#pricing" className="text-white/80 hover:text-white transition-colors">Pricing</a>
                  <button
                    onClick={() => onPageChange('signin')}
                    className="text-left text-white/80 hover:text-white transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => onPageChange('signup')}
                    className="bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-lg hover:bg-white/30 transition-colors text-left border border-white/30"
                  >
                    Get Started
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onPageChange('dashboard')}
                    className="text-left text-white/80 hover:text-white transition-colors"
                  >
                    Dashboard
                  </button>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-medium border border-white/30">
                      {user?.name?.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white">{user?.name}</span>
                      {onSignOut && (
                        <button
                          onClick={onSignOut}
                          className="text-white/80 hover:text-white text-sm text-left transition-colors"
                        >
                          Sign Out
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;