import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/600.css';
import '@achoo254/app-shell/tokens.css';
import '@achoo254/app-shell/app-shell.css';
import './styles/app.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AccountProvider, useAccount } from './account';
import { I18nProvider } from './i18n';
import { Layout } from './layout';
import { CreatePage } from './pages/create-page';
import { IntroPage } from './pages/intro-page';
import { LoginPage } from './pages/login-page';
import { CreditsPage, PrivacyPage, TermsPage } from './pages/legal-pages';
import { NotFound } from './pages/not-found';
import { TemplatePage, TemplatesIndexPage } from './pages/template-pages';
import { VideosPage } from './pages/videos-page';

/** Signed out: the intro; signed in: straight to making a video. */
function Home(): ReactNode {
  const { me } = useAccount();
  if (!me) return null;
  return me.signedIn ? <CreatePage /> : <IntroPage />;
}

const container = document.getElementById('root');
if (!container) throw new Error('#root missing in index.html');
createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <AccountProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tao" element={<CreatePage />} />
              <Route path="/video" element={<VideosPage />} />
              <Route path="/mau" element={<TemplatesIndexPage />} />
              <Route path="/mau/:id" element={<TemplatePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AccountProvider>
    </I18nProvider>
  </StrictMode>,
);
