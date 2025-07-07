import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import SigningPage from './components/SigningPage';
import Footer from './components/Footer';
import { Page, User } from './types';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [user, setUser] = useState<User | null>(null);

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
  };

  const handleSignIn = (email: string, password: string) => {
    // Mock authentication
    const mockUser: User = {
      id: '1',
      name: 'John Doe',
      email: email,
      avatar: undefined
    };
    setUser(mockUser);
    setCurrentPage('dashboard');
  };

  const handleSignUp = (name: string, email: string, password: string) => {
    // Mock registration
    const mockUser: User = {
      id: '1',
      name: name,
      email: email,
      avatar: undefined
    };
    setUser(mockUser);
    setCurrentPage('dashboard');
  };

  const handleSignOut = () => {
    setUser(null);
    setCurrentPage('landing');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onPageChange={handlePageChange} />;
      case 'signin':
        return <SignIn onPageChange={handlePageChange} onSignIn={handleSignIn} />;
      case 'signup':
        return <SignUp onPageChange={handlePageChange} onSignUp={handleSignUp} />;
      case 'dashboard':
        return user ? <Dashboard user={user} onPageChange={handlePageChange} /> : <LandingPage onPageChange={handlePageChange} />;
      default:
        return <LandingPage onPageChange={handlePageChange} />;
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Routes>
          {/* Public signing route */}
          <Route path="/sign/:documentId/:recipientId" element={<SigningPage />} />
          
          {/* Main application routes */}
          <Route path="*" element={
            <div className="min-h-screen">
              <Header 
                currentPage={currentPage} 
                onPageChange={handlePageChange}
                isAuthenticated={!!user}
                user={user || undefined}
              />
              {renderCurrentPage()}
              {currentPage === 'landing' && <Footer />}
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;