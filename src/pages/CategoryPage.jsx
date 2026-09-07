import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useLanguage, usePreserveLanguage } from '../App';
import './CategoryPage.css';

function CategoryPage() {
  const { categoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { language, content } = useLanguage();
  const { addLanguageToPath } = usePreserveLanguage();
  const [categories, setCategories] = useState(null);
  const [items, setItems] = useState(null);
  const [category, setCategory] = useState(null);
  const scrollPositionRef = useRef(0);
  const isChangingSubcategory = useRef(false);
  const itemsGridRef = useRef(null);
  const hasRestoredRef = useRef(false);
  const lastViewKeyRef = useRef('');
  const isRestoringRef = useRef(false);
  const periodicSaveEnabledRef = useRef(true);
  const headerRef = useRef(null);
  const spacerRef = useRef(null);

  // Get subcategory from URL query params
  const selectedSubcategory = searchParams.get('subcategory') || null;
  const currentViewKey = `${categoryId}-${selectedSubcategory || 'all'}`;
  
  // Check immediately (synchronously) if we should restore - before any effects run
  const scrollKey = `category-${categoryId}-${selectedSubcategory || 'all'}-scroll`;
  const savedScrollPosition = sessionStorage.getItem(scrollKey);
  if (savedScrollPosition) {
    const scrollValue = parseInt(savedScrollPosition, 10);
    if (!isNaN(scrollValue) && scrollValue > 0) {
      isRestoringRef.current = true;
      hasRestoredRef.current = false;
      periodicSaveEnabledRef.current = false;
    }
  }

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Set spacer height to match header height on desktop (including navbar offset)
  useEffect(() => {
    if (window.innerWidth >= 769 && headerRef.current && spacerRef.current && category) {
      const updateSpacerHeight = () => {
        if (headerRef.current && spacerRef.current) {
          const headerHeight = headerRef.current.offsetHeight;
          const navbarHeight = 60; // Approximate navbar height
          spacerRef.current.style.height = `${navbarHeight + headerHeight}px`;
        }
      };
      // Use setTimeout to ensure DOM is updated
      setTimeout(updateSpacerHeight, 0);
      // Also update after a short delay to ensure content is rendered
      setTimeout(updateSpacerHeight, 100);
      window.addEventListener('resize', updateSpacerHeight);
      return () => window.removeEventListener('resize', updateSpacerHeight);
    }
  }, [category, selectedSubcategory, language]);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/categories.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}data/items.json`).then(res => res.json())
    ])
      .then(([categoriesData, itemsData]) => {
        setCategories(categoriesData);
        setItems(itemsData);
        
        const categoryIdNum = parseInt(categoryId);
        const foundCategory = categoriesData.categories?.find(c => c.id === categoryIdNum);
        setCategory(foundCategory);
      })
      .catch(err => console.error('Failed to load data:', err));
  }, [categoryId]);

  // Get scroll key for current category/subcategory
  const getScrollKey = () => {
    return `category-${categoryId}-${selectedSubcategory || 'all'}-scroll`;
  };

  // Save scroll position immediately (but not during restoration)
  const saveScrollPosition = () => {
    // Don't save if periodic save is disabled (during restoration check)
    if (!periodicSaveEnabledRef.current) {
      return;
    }
    // Don't save if we're currently restoring - this prevents overwriting the saved position
    if (isRestoringRef.current) {
      return;
    }
    const scrollKey = getScrollKey();
    const currentScroll = window.scrollY;
    
    // Never save scroll position 0 - that's the default, no need to store it
    if (currentScroll === 0) {
      return;
    }
    
    sessionStorage.setItem(scrollKey, currentScroll.toString());
    scrollPositionRef.current = currentScroll;
  };

  // Reset restoration flag when view changes
  useEffect(() => {
    if (lastViewKeyRef.current !== currentViewKey) {
      hasRestoredRef.current = false;
      lastViewKeyRef.current = currentViewKey;
    }
  }, [currentViewKey]);

  // Re-check on navigation changes (this is a backup to the synchronous check above)
  useEffect(() => {
    const scrollKey = getScrollKey();
    const savedScrollPosition = sessionStorage.getItem(scrollKey);
    
    if (savedScrollPosition) {
      const scrollValue = parseInt(savedScrollPosition, 10);
      if (!isNaN(scrollValue) && scrollValue > 0) {
        isRestoringRef.current = true;
        hasRestoredRef.current = false;
        periodicSaveEnabledRef.current = false;
      }
    } else {
      isRestoringRef.current = false;
      periodicSaveEnabledRef.current = true;
    }
  }, [categoryId, selectedSubcategory, location.pathname]);

  // Restore scroll position when items are loaded
  useEffect(() => {
    if (!items || !category) return;
    
    // Don't restore if we're changing subcategory
    if (isChangingSubcategory.current) {
      isChangingSubcategory.current = false;
      hasRestoredRef.current = true;
      isRestoringRef.current = false;
      return;
    }
    
    // Don't restore if we've already restored for this view
    if (hasRestoredRef.current) return;
    
    const scrollKey = getScrollKey();
    const savedScrollPosition = sessionStorage.getItem(scrollKey);
    
    if (savedScrollPosition) {
      const scrollValue = parseInt(savedScrollPosition, 10);
      if (!isNaN(scrollValue) && scrollValue > 0) {
        // Restore immediately - try right away
        const restore = () => {
          window.scrollTo(0, scrollValue);
          hasRestoredRef.current = true;
          // Allow saving again after a delay
          setTimeout(() => {
            isRestoringRef.current = false;
            periodicSaveEnabledRef.current = true;
          }, 500);
        };
        
        // Try immediately
        const grid = itemsGridRef.current || document.querySelector('.items-grid');
        if (grid && grid.children.length > 0) {
          restore();
        } else {
          // If grid not ready, try a few times quickly
          let attempts = 0;
          const checkAndRestore = setInterval(() => {
            attempts++;
            const grid = itemsGridRef.current || document.querySelector('.items-grid');
            if ((grid && grid.children.length > 0) || attempts > 10) {
              clearInterval(checkAndRestore);
              restore();
            }
          }, 20);
        }
      } else {
        hasRestoredRef.current = true;
        isRestoringRef.current = false;
        periodicSaveEnabledRef.current = true;
      }
    } else {
      hasRestoredRef.current = true;
      isRestoringRef.current = false;
      periodicSaveEnabledRef.current = true;
    }
  }, [items, category, categoryId, selectedSubcategory, currentViewKey]);

  // Save scroll position on scroll and periodically
  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
    };

    // Save scroll position periodically
    const scrollInterval = setInterval(() => {
      saveScrollPosition();
    }, 500);

    window.addEventListener('scroll', handleScroll);
    
    // Save scroll position when leaving the page
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(scrollInterval);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save final scroll position
      saveScrollPosition();
    };
  }, [categoryId, selectedSubcategory]);

  // Function to update subcategory in URL (preserves language parameter)
  const handleSubcategoryChange = (subcategoryId) => {
    isChangingSubcategory.current = true;
    const newSearchParams = new URLSearchParams(searchParams);
    if (subcategoryId) {
      newSearchParams.set('subcategory', subcategoryId);
    } else {
      newSearchParams.delete('subcategory');
    }
    // Language parameter is already in searchParams, so it will be preserved
    setSearchParams(newSearchParams, { replace: true });
    // Reset scroll when changing subcategory
    window.scrollTo(0, 0);
    scrollPositionRef.current = 0;
  };

  if (!content || !categories || !items || !category) {
    return <div className="loading">Loading...</div>;
  }

  const text = content[language] || content.en;
  const categoryIdNum = parseInt(categoryId);
  const subcategories = category.subcategories || [];
  
  // Filter items by category and optionally by subcategory
  let activeItems = items.items?.filter(item => 
    item.active !== false && 
    item.categories?.includes(categoryIdNum)
  ) || [];
  
  // If a subcategory is selected, filter by it
  if (selectedSubcategory) {
    activeItems = activeItems.filter(item => 
      item.subcategory === selectedSubcategory
    );
  }

  // Sort items alphabetically by title
  activeItems = activeItems.sort((a, b) => {
    const titleA = (a[language]?.title || a.en?.title || '').toLowerCase();
    const titleB = (b[language]?.title || b.en?.title || '').toLowerCase();
    return titleA.localeCompare(titleB);
  });

  // Helper function to get item title - always use English unless non-placeholder translation exists
  const getItemTitle = (item) => {
    // Always prefer English title
    if (item.en?.title) {
      return item.en.title;
    }
    // Only use other language if it's not empty and not a placeholder (like "Artikel X")
    const otherLangTitle = item[language]?.title;
    if (otherLangTitle && otherLangTitle.trim() !== '' && !otherLangTitle.match(/^Artikel\s+\d+$/i)) {
      return otherLangTitle;
    }
    // Fallback to English
    return item.en?.title || '';
  };

  // Normalize image paths to work with BASE_URL
  const normalizeImagePath = (imagePath) => {
    if (!imagePath) return '';
    // Remove leading /for-sale/images/ and make it relative to BASE_URL
    if (imagePath.startsWith('/for-sale/images/')) {
      const filename = imagePath.replace('/for-sale/images/', '');
      return `${import.meta.env.BASE_URL}images/${filename}`;
    }
    // If path is already relative (images/...), prepend BASE_URL
    if (imagePath.startsWith('images/')) {
      return `${import.meta.env.BASE_URL}${imagePath}`;
    }
    // If path is absolute but not /for-sale/, keep it as is
    if (imagePath.startsWith('/')) {
      return imagePath;
    }
    // Otherwise, prepend BASE_URL
    return `${import.meta.env.BASE_URL}${imagePath}`;
  };

  // Listing cards use item-40.jpg generated from the first image (item-40-1.*)
  const getThumbnailPath = (imagePath) => {
    if (!imagePath) return '';
    return normalizeImagePath(imagePath.replace(/-\d+\.(png|jpe?g|webp)$/i, '.jpg'));
  };

  return (
    <div className="category-page">
      <div className="category-header" ref={headerRef}>
        <Link to={addLanguageToPath("/")} className="back-link">{text.backToCategories}</Link>
        <h1>{category[language]?.name || category.en?.name}</h1>
        
        {/* Subcategory filters */}
        {subcategories.length > 0 && (
          <div className="subcategory-filters">
            <button
              className={`subcategory-filter ${selectedSubcategory === null ? 'active' : ''}`}
              onClick={() => handleSubcategoryChange(null)}
            >
              All
            </button>
            {subcategories.map((subcat) => (
              <button
                key={subcat.id}
                className={`subcategory-filter ${selectedSubcategory === subcat.id ? 'active' : ''}`}
                onClick={() => handleSubcategoryChange(subcat.id)}
              >
                {subcat[language]?.name || subcat.en?.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="category-header-spacer" ref={spacerRef}></div>
      
      {activeItems.length === 0 ? (
        <p className="no-items">No items available{selectedSubcategory ? ' in this subcategory' : ' in this category'}.</p>
      ) : (
        <div className="items-grid" ref={itemsGridRef}>
          {activeItems.map((item) => (
            <Link
              key={item.id}
              to={addLanguageToPath(`/item/${item.id}`)}
              className="item-card"
              onClick={saveScrollPosition}
            >
              {item.images && item.images.length > 0 && (
                <div className="item-image">
                  <img src={getThumbnailPath(item.images[0])} alt={getItemTitle(item)} loading="lazy" />
                </div>
              )}
              <div className="item-content">
                <h2>{getItemTitle(item)}</h2>
                <div className="item-price">{item.price} SEK</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryPage;

