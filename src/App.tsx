import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import DocumentSign from './components/DocumentSign';
import Footer from './components/Footer';
import { Page, AuthUser } from './types';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const { user, loading, signIn, signUp, signOut, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (user && (currentPage === 'landing' || currentPage === 'signin' || currentPage === 'signup')) {
      setCurrentPage('dashboard');
    } else if (!user && currentPage === 'dashboard') {
      setCurrentPage('landing');
    }
  }, [user, currentPage]);

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
  };

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    if (!error) setCurrentPage('dashboard');
    return { error };
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    const { error } = await signUp(email, password, name);
    if (!error) setCurrentPage('dashboard');
    return { error };
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentPage('landing');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Routes>
          <Route path="/sign/:documentId/:token" element={<DocumentSign />} />
          <Route
            path="*"
            element={
              <div className="min-h-screen">
                <Header
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  isAuthenticated={!!user}
                  user={user}
                  onSignOut={handleSignOut}
                />
                {(() => {
                  switch (currentPage) {
                    case 'landing':
                      return <LandingPage onPageChange={handlePageChange} />;
                    case 'signin':
                      return <SignIn onPageChange={handlePageChange} onSignIn={handleSignIn} onSignInWithGoogle={signInWithGoogle} />;
                    case 'signup':
                      return <SignUp onPageChange={handlePageChange} onSignUp={handleSignUp} onSignInWithGoogle={signInWithGoogle} />;
                    case 'dashboard':
                      return user ? (
                        <Dashboard user={user} onPageChange={handlePageChange} />
                      ) : (
                        <Navigate to="/" replace />
                      );
                    default:
                      return <LandingPage onPageChange={handlePageChange} />;
                  }
                })()}
                {currentPage === 'landing' && <Footer />}
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;