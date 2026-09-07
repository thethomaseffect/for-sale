import { Routes, Route, useLocation, Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import ItemDetail from './pages/ItemDetail';
import './App.css';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

// Helper hook to preserve language parameter in URLs
export const usePreserveLanguage = () => {
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang');
  
  const addLanguageToPath = (path) => {
    if (lang && lang !== 'en') {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}lang=${lang}`;
    }
    return path;
  };
  
  return { addLanguageToPath, currentLang: lang };
};

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { addLanguageToPath } = usePreserveLanguage();
  
  // Get language from URL query param, default to 'en'
  const urlLang = searchParams.get('lang');
  const [language, setLanguage] = useState(() => {
    // Initialize from URL on mount
    if (urlLang && (urlLang === 'sv' || urlLang === 'en')) {
      return urlLang;
    }
    return 'en';
  });
  const [content, setContent] = useState(null);

  // Update language when URL param changes (e.g., browser back/forward)
  useEffect(() => {
    const urlLang = searchParams.get('lang');
    if (urlLang && (urlLang === 'sv' || urlLang === 'en')) {
      if (language !== urlLang) {
        setLanguage(urlLang);
      }
    } else if (!urlLang && language !== 'en') {
      // If no lang param and we're not on English, default to English
      setLanguage('en');
    }
  }, [searchParams]);

  // Prevent React Router from automatically scrolling to top
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/content.json`)
      .then(res => res.json())
      .then(data => setContent(data))
      .catch(err => console.error('Failed to load content:', err));
  }, []);

  // Function to update language and URL
  const updateLanguage = (newLang) => {
    setLanguage(newLang);
    const newSearchParams = new URLSearchParams(searchParams);
    if (newLang === 'en') {
      // Remove lang param for English (default)
      newSearchParams.delete('lang');
    } else {
      // Set lang param for other languages
      newSearchParams.set('lang', newLang);
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const text = content ? (content[language] || content.en) : null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage: updateLanguage, content }}>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to={addLanguageToPath('/')} className="logo">{text?.headerTitle || 'For Sale'}</Link>
            <div className="language-switcher">
              <button 
                onClick={() => updateLanguage('en')} 
                className={language === 'en' ? 'active' : ''}
              >
                EN
              </button>
              <button 
                onClick={() => updateLanguage('sv')} 
                className={language === 'sv' ? 'active' : ''}
              >
                SV
              </button>
            </div>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/category/:categoryId" element={<CategoryPage />} />
            <Route path="/item/:itemId" element={<ItemDetail />} />
          </Routes>
        </main>
      </div>
    </LanguageContext.Provider>
  );
}

export default App;

