import React, { useState, useMemo, useRef, useEffect } from 'react';

/**
 * 店舗名の統合検索フィールド（法人名・ブランド名・店舗名・電話で検索）
 * @param {Object} props
 * @param {Array} props.stores - 店舗一覧（{ id, name, store_name, client_name, brand_name, phone, ... }）
 * @param {string} props.value - 表示値（店舗名）
 * @param {string} props.storeKey - 選択中の store id / key
 * @param {function} props.onChange - ({ store_name, store_key }) => void
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 */
export default function StoreSearchField({ stores = [], value = '', storeKey = '', onChange, placeholder = '法人名・ブランド名・店舗名で検索', id, disabled }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);

  const normalizedStores = Array.isArray(stores) ? stores : [];

  const searchResults = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return normalizedStores
      .filter((store) => {
        const storeName = (store.name || store.store_name || store.id || '').toLowerCase();
        const clientName = (store.client_name || '').toLowerCase();
        const brandName = (store.brand_name || '').toLowerCase();
        const phone = (store.phone || store.tel || store.phone_number || '').toLowerCase();
        const text = `${storeName} ${clientName} ${brandName} ${phone}`.trim();
        return text && text.includes(q);
      })
      .slice(0, 20)
      .map((store) => ({
        store,
        displayText: `${store.brand_name || '（ブランド不明）'} / ${store.name || store.store_name || store.id || '（店舗不明）'} / ${store.client_name || '（法人不明）'}`.trim(),
      }));
  }, [searchQuery, normalizedStores]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchResults.length]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const v = e.target.value;
    setSearchQuery(v);
    setShowDropdown(true);
    onChange({ store_name: v, store_key: '' });
  };

  const handleSelect = (item) => {
    const name = item.store.name || item.store.store_name || '';
    const key = item.store.id || item.store.key || '';
    setSearchQuery('');
    setShowDropdown(false);
    onChange({ store_name: name, store_key: key });
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || searchResults.length === 0) {
      if (e.key === 'Escape') setShowDropdown(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(searchResults[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="store-search-field" style={{ position: 'relative' }}>
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleInputChange}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {showDropdown && searchResults.length > 0 && (
        <ul
          className="store-search-dropdown"
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            maxHeight: 240,
            overflowY: 'auto',
            background: 'var(--panel-bg)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 100,
          }}
        >
          {searchResults.map((item, i) => (
            <li
              key={item.store.id || item.store.key || i}
              role="option"
              aria-selected={i === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: i < searchResults.length - 1 ? '1px solid var(--line)' : 'none',
                background: i === highlightedIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                fontSize: '0.9rem',
              }}
            >
              {item.displayText}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
