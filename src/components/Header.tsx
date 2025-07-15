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
  const [sendGridStatus, setSendGridStatus] = React.useState<string | null>(null);

  const testSendGridIntegration = async () => {
    try {
      setSendGridStatus('Testing...');

      // SendGrid API request based on the provided cURL
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: user?.email }] }],
          from: { email: 'support@signpearl.com' },
          subject: 'SendGrid Integration Test',
          content: [
            {
              type: 'text/plain',
              value: 'This is a test email sent from SignPearl using SendGrid!',
            },
            {
              type: 'text/html',
              value: '<p>This is a test email sent from SignPearl using SendGrid!</p>',
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`SendGrid API error: ${response.statusText}`);
      }

      setSendGridStatus('Test email sent successfully!');
      
      // Reset status after 3 seconds
      setTimeout(() => setSendGridStatus(null), 3000);
    } catch (error) {
      console.error('SendGrid test failed:', error);
      setSendGridStatus('Failed to send test email');
      setTimeout(() => setSendGridStatus(null), 3000);
    }
  };

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
                <button
                  onClick={testSendGridIntegration}
                  className="bg-green-500/20 backdrop-blur-sm text-white px-4 py-1 rounded-lg hover:bg-green-500/30 transition-colors border border-green-500/30 text-sm"
                  disabled={sendGridStatus === 'Testing...'}
                >
                  {sendGridStatus || 'Test SendGrid'}
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
                  <button
                    onClick={testSendGridIntegration}
                    className="bg-green-500/20 backdrop-blur-sm text-white px-6 py-2 rounded-lg hover:bg-green-500/30 transition-colors text-left border border-green-500/30"
                    disabled={sendGridStatus === 'Testing...'}
                  >
                    {sendGridStatus || 'Test SendGrid'}
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