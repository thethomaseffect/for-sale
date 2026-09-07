import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, usePreserveLanguage } from '../App';
import './Home.css';

function Home() {
  const { language, content } = useLanguage();
  const { addLanguageToPath } = usePreserveLanguage();
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/categories.json`)
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Failed to load categories:', err));
  }, []);

  if (!content || !categories) {
    return <div className="loading">Loading...</div>;
  }

  const text = content[language] || content.en;
  const categoryList = categories.categories || [];

  return (
    <div className="home">
      <h1>{text.title}</h1>
      <p className="description">{text.description}</p>

      <div className="categories-grid">
        {categoryList.map((category) => (
          <Link
            key={category.id}
            to={addLanguageToPath(`/category/${category.id}`)}
            className="category-card"
          >
            <div className="category-icon">{category.icon || '📦'}</div>
            <h2>{category[language]?.name || category.en?.name}</h2>
            {category[language]?.description && (
              <p>{category[language].description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Home;

