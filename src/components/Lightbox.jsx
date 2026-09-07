import { useEffect } from 'react';
import './Lightbox.css';

function Lightbox({ images, currentIndex, onClose, onNext, onPrev, title }) {
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

  const normalizedImages = images.map(normalizeImagePath);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        onNext();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, onNext, onPrev]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>×</button>
        <button className="lightbox-nav lightbox-prev" onClick={onPrev}>
          ‹
        </button>
        <div className="lightbox-image-container">
          <img
            src={normalizedImages[currentIndex]}
            alt={`${title} ${currentIndex + 1}`}
          />
          <div className="lightbox-counter">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
        <button className="lightbox-nav lightbox-next" onClick={onNext}>
          ›
        </button>
      </div>
    </div>
  );
}

export default Lightbox;

