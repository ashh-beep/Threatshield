import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from '@components/layout/Navbar';
import { Footer } from '@components/layout/Footer';
import { ThreatShieldAdminLayout } from '@components/layout/ThreatShieldAdminLayout';
import { HomePage } from '@pages/HomePage';
import { ScannerPage } from '@pages/ScannerPage';
import { LoginPage } from '@pages/auth/LoginPage';
import { RegisterPage } from '@pages/auth/RegisterPage';
import { ProtectedRoute, PublicRoute } from '@components/auth/ProtectedRoute';
import { DashboardPage } from '@pages/dashboard/DashboardPage';
import { ScanDetailPage } from '@pages/dashboard/ScanDetailPage';
import { ProfilePage } from '@pages/dashboard/ProfilePage';
import { OrgAdminDashboardPage } from '@pages/org-admin/OrgAdminDashboardPage';
import { OrgAdminUsersPage } from '@pages/org-admin/OrgAdminUsersPage';
import { OrgAdminUserProfilePage } from '@pages/org-admin/OrgAdminUserProfilePage';
import { OrgAdminProvisioningPage } from '@pages/org-admin/OrgAdminProvisioningPage';
import { OrgAdminAuthenticationPage } from '@pages/org-admin/OrgAdminAuthenticationPage';
import { OrgAdminActivityPage } from '@pages/org-admin/OrgAdminActivityPage';
import { OrgAdminSettingsPage } from '@pages/org-admin/OrgAdminSettingsPage';
import { OrgAdminLayout } from '@components/layout/OrgAdminLayout';
import { SuperAdminDashboardPage } from '@pages/super-admin/SuperAdminDashboardPage';
import { SuperAdminOrganizationsPage } from '@pages/super-admin/SuperAdminOrganizationsPage';
import { SuperAdminOrganizationDetailsPage } from '@pages/super-admin/SuperAdminOrganizationDetailsPage';
import { SuperAdminCreateClientPage } from '@pages/super-admin/SuperAdminCreateClientPage';
import { SuperAdminCreateAdminPage } from '@pages/super-admin/SuperAdminCreateAdminPage';
import { SuperAdminAdminsPage } from '@pages/super-admin/SuperAdminAdminsPage';
import { SuperAdminAdminProfilePage } from '@pages/super-admin/SuperAdminAdminProfilePage';
import { SuperAdminProvisioningPage } from '@pages/super-admin/SuperAdminProvisioningPage';
import { SuperAdminActivityPage } from '@pages/super-admin/SuperAdminActivityPage';
import { SuperAdminSettingsPage } from '@pages/super-admin/SuperAdminSettingsPage';
import { SSOCallbackPage } from '@pages/auth/SSOCallbackPage';
import { AcceptInvitePage } from '@pages/auth/AcceptInvitePage';

const sections = ['home', 'how-it-works', 'detection', 'security', 'about'] as const;
type Section = typeof sections[number];

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/org-admin') || location.pathname.startsWith('/threatshield-admin');

  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [showScanner, setShowScanner] = useState(false);

  const scrollToSection = useCallback((section: string) => {
    setCurrentSection(section as Section);
    setShowScanner(false);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScannerNavigate = useCallback(() => {
    setShowScanner(true);
    setCurrentSection('home');
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            setCurrentSection(entry.target.id as Section);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!isAdminRoute && <Navbar currentSection={currentSection} onNavigate={scrollToSection} />}
      
      <main id="main-content" className={isAdminRoute ? '' : 'pt-16'} role="main">
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route path="/auth/sso/callback" element={<SSOCallbackPage />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          
          {/* Public landing page with scanner */}
          <Route
            path="/"
            element={
              <>
                {showScanner ? (
                  <ScannerPage />
                ) : (
                  <HomePage onNavigate={handleScannerNavigate} />
                )}
              </>
            }
          />
          
          {/* User dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['user', 'org_admin', 'super_admin']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scan/:scanId"
            element={
              <ProtectedRoute allowedRoles={['user', 'org_admin', 'super_admin']}>
                <ScanDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['user', 'org_admin', 'super_admin']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          
          {/* Organization Admin routes */}
          <Route element={<OrgAdminLayout />}>
            <Route
              path="/org-admin"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/users"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/users/:userId"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminUserProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/provisioning"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminProvisioningPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/authentication"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminAuthenticationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/activity"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminActivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/settings"
              element={
                <ProtectedRoute allowedRoles="org_admin">
                  <OrgAdminSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          
          {/* Super Admin routes */}
          <Route element={<ThreatShieldAdminLayout />}>
            <Route
              path="/threatshield-admin"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/organizations"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminOrganizationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/organizations/:organizationId"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminOrganizationDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/create-client"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminCreateClientPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/create-admin"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminCreateAdminPage />
              </ProtectedRoute>
            }
            />
            <Route
              path="/threatshield-admin/admins"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminAdminsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/admins/:adminId"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminAdminProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/provisioning"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminProvisioningPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/activity"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminActivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/threatshield-admin/settings"
              element={
                <ProtectedRoute allowedRoles="super_admin">
                  <SuperAdminSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isAdminRoute && <Footer />}
    </div>
  );
}

export default App;