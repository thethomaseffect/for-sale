import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage, usePreserveLanguage } from '../App';
import Lightbox from '../components/Lightbox';
import './ItemDetail.css';

function ItemDetail() {
  const { itemId } = useParams();
  const { language, content } = useLanguage();
  const { addLanguageToPath } = usePreserveLanguage();
  const [item, setItem] = useState(null);
  const [conditions, setConditions] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/items.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}data/conditions.json`).then(res => res.json())
    ])
      .then(([itemsData, conditionsData]) => {
        const foundItem = itemsData.items?.find(i => i.id === parseInt(itemId));
        setItem(foundItem);
        setConditions(conditionsData);
      })
      .catch(err => console.error('Failed to load data:', err));
  }, [itemId]);

  if (!content || !item || !conditions) {
    return <div className="loading">Loading...</div>;
  }

  const text = content[language] || content.en;
  
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
  
  const itemTitle = getItemTitle(item);
  const itemText = item[language] || item.en || {};
  const rawImages = item.images || [];
  
  // Get condition name (only if condition is a valid integer between 1-5)
  const conditionId = item.condition;
  // Convert to integer and validate it's between 1-5
  const conditionIdNum = conditionId !== undefined && conditionId !== null ? parseInt(conditionId, 10) : 0;
  const isValidCondition = !isNaN(conditionIdNum) && conditionIdNum >= 1 && conditionIdNum <= 5;
  const condition = isValidCondition ? conditions.conditions?.find(c => c.id === conditionIdNum) : null;
  const conditionName = condition ? (condition[language]?.name || condition.en?.name) : null;

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

  const images = rawImages.map(normalizeImagePath);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Build back link with subcategory query parameter if item has one
  const getBackLink = () => {
    const categoryId = item.categories?.[0];
    if (!categoryId) return addLanguageToPath('/');
    
    let backLink = `/category/${categoryId}`;
    if (item.subcategory) {
      backLink += `?subcategory=${item.subcategory}`;
    }
    return addLanguageToPath(backLink);
  };

  return (
    <div className="item-detail">
      <Link to={getBackLink()} className="back-link">
        {text.backToCategory}
      </Link>

      <div className="item-detail-content">
        <div className="item-images">
          {images.length > 0 ? (
            <>
              <div className="main-image">
                <img
                  src={images[0]}
                  alt={itemTitle}
                  onClick={() => openLightbox(0)}
                />
              </div>
              {images.length > 1 && (
                <div className="thumbnail-images">
                  {images.slice(1).map((img, index) => (
                    <img
                      key={index + 1}
                      src={img}
                      alt={`${itemTitle} ${index + 2}`}
                      onClick={() => openLightbox(index + 1)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="no-image">No image available</div>
          )}
        </div>

        <div className="item-info">
          <h1>{itemTitle}</h1>
          <div className="item-price">{item.price} SEK</div>

          <div className="item-description">
            <h2>{text.descriptionLabel}</h2>
            <p>{itemText.description}</p>
          </div>

          {conditionName && (
            <div className="item-condition">
              <span className="condition-label">
                {text.conditionLabel}: <span className={`condition-value ${conditionIdNum === 5 ? 'condition-acceptable' : 'condition-good'}`}>{conditionName}</span>
              </span>
              {isValidCondition && item.qualityNotes && (
                (typeof item.qualityNotes === 'object' 
                  ? (item.qualityNotes[language] || item.qualityNotes.en || '')
                  : item.qualityNotes) !== "" && (
                  <p className="quality-notes">
                    {typeof item.qualityNotes === 'object' 
                      ? (item.qualityNotes[language] || item.qualityNotes.en || '')
                      : item.qualityNotes}
                  </p>
                )
              )}
            </div>
          )}

          <div className="item-terms">
            <h2>{text.termsTitle}</h2>
            <p>{text.termsText}</p>
          </div>
        </div>
      </div>

      {lightboxOpen && images.length > 0 && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={nextImage}
          onPrev={prevImage}
          title={itemTitle}
        />
      )}
    </div>
  );
}

export default ItemDetail;

