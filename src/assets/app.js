// Minimal modal wiring for service items (dummy data OK)
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  // ベースパスを取得（GitHub Pages対応）
  function getBasePath() {
    const base = document.querySelector('base');
    if (base && base.href) {
      try {
        const url = new URL(base.href);
        return url.pathname;
      } catch (e) {
        return base.getAttribute('href') || '/';
      }
    }
    const path = window.location.pathname;
    if (path.includes('/misesapo/')) {
      return '/misesapo/';
    }
    return '/';
  }

  // 絶対パスをベースパス付きに変換
  // fetch用：baseタグの影響を受けないように絶対URLを返す
  function resolvePath(path) {
    if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
      return path;
    }
    
    // ローカル開発環境ではbaseタグを無視
    const hostname = window.location.hostname;
    const isLocalDev = hostname === 'localhost' || 
                      hostname === '127.0.0.1' ||
                      hostname === '';
    
    if (isLocalDev) {
      return path.startsWith('/') ? path : '/' + path;
    }
    
    // 既に/misesapo/で始まるパスはそのまま絶対URLに変換
    if (path.startsWith('/misesapo/')) {
      return window.location.origin + path;
    }
    
    const basePath = getBasePath();
    let resolvedPath;
    if (path.startsWith('/')) {
      resolvedPath = basePath === '/' ? path : basePath.slice(0, -1) + path;
    } else {
      resolvedPath = basePath === '/' ? '/' + path : basePath + path;
    }
    
    // fetch用に絶対URLを返す（baseタグの影響を受けないようにする）
    return window.location.origin + resolvedPath;
  }

  function renderSections(container, sections, namePrefix) {
    if (!container) return;
    clear(container);
    const forms = sections || [];
    forms.forEach((sec, idx) => {
      const wrap = document.createElement('div');
      
      // セクション画像がある場合は表示
      const sectionImage = sec['section-image'] || sec['section-image-url'] || '';
      if (sectionImage.trim()) {
        const img = document.createElement('img');
        img.className = 'section-image';
        img.style.cssText = 'width: 100%; max-width: 400px; height: auto; border-radius: 8px; margin-bottom: 12px; object-fit: cover;';
        const imgPath = sectionImage.trim();
        // 画像パスの処理: GitHub Pages対応
        img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
        img.alt = sec['section-title'] || 'セクション画像';
        img.onerror = function() {
          this.style.display = 'none';
        };
        wrap.appendChild(img);
      }
      
      const h = document.createElement('h3');
      h.className = 'section-title';
      h.textContent = sec['section-title'] || '';
      wrap.appendChild(h);
      const type = (sec['section-type'] || 'radio-text').toLowerCase();
      const body = document.createElement('div');
      body.className = (type === 'grid' || type === 'grid-items' || type === 'items') ? 'grid grid-2-4 gap-16' : 'stack sm';
      const name = `${namePrefix}_${idx+1}`;
      const items = sec['section-items'] || [];

      items.forEach((it) => {
        const hasImg = !!(it && (it['img-url'] || it['img']));
        if (type === 'grid' || type === 'grid-items' || type === 'items') {
          // Card with optional counter, matches previous design
          const card = document.createElement('div');
          card.className = 'item-card text-center';
          const img = document.createElement('img');
          img.className = 'avatar-round';
          const imgPath = it['img-url'] || it['img'] || 'https://placehold.co/150x150/e2e8f0/666';
          // 画像パスの処理: GitHub Pages対応
          img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
          img.alt = (it['text'] || '');
          img.onerror = function() {
            this.src = resolvePath('/images/service-300x200.svg');
          };
          const p = document.createElement('p');
          p.className = 'item-name';
          p.textContent = it['text'] || '';
          card.appendChild(img);
          card.appendChild(p);

          if (it['countable']) {
            const qty = document.createElement('div');
            qty.className = 'qty';
            const dec = document.createElement('button');
            dec.className = 'btn btn-ghost btn-qty';
            dec.dataset.delta = '-1';
            dec.textContent = '-';
            const span = document.createElement('span');
            span.className = 'qty-val';
            span.textContent = String(it['count'] ?? 0);
            const inc = document.createElement('button');
            inc.className = 'btn btn-ghost btn-qty';
            inc.dataset.delta = '1';
            inc.textContent = '+';
            const unit = document.createElement('span');
            unit.className = 'muted unit';
            unit.textContent = it['unit'] || '';
            qty.appendChild(dec);
            qty.appendChild(span);
            qty.appendChild(inc);
            qty.appendChild(unit);
            card.appendChild(qty);
          }
          body.appendChild(card);
        } else if (type === 'radio-image' || hasImg) {
          const label = document.createElement('label');
          label.className = 'choice-card';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = name;
          input.className = 'radio';
          const img = document.createElement('img');
          img.className = 'thumb-211';
          const imgPath = it['img-url'] || it['img'] || resolvePath('/images/service-300x200.svg');
          // 画像パスの処理: GitHub Pages対応
          img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
          img.alt = (it['text'] || '');
          img.onerror = function() {
            this.src = resolvePath('/images/service-300x200.svg');
          };
          const span = document.createElement('span');
          span.textContent = it['text'] || '';
          label.appendChild(input);
          label.appendChild(img);
          label.appendChild(span);
          body.appendChild(label);
        } else {
          const label = document.createElement('label');
          label.className = 'choice-row';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = name;
          input.className = 'radio';
          const span = document.createElement('span');
          span.textContent = (typeof it === 'string') ? it : (it['text'] || '');
          label.appendChild(input);
          label.appendChild(span);
          body.appendChild(label);
        }
      });

      wrap.appendChild(body);
      container.appendChild(wrap);
    });

    // Hook quantity controls
    container.querySelectorAll('.btn-qty').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const root = btn.closest('.qty');
        const span = root && root.querySelector('.qty-val');
        if (!span) return;
        const cur = parseInt(span.textContent || '0', 10) || 0;
        const delta = parseInt(btn.dataset.delta || '0', 10) || 0;
        const next = Math.max(0, cur + delta);
        span.textContent = String(next);
      });
    });
  }

  function openModal(data) {
    const modal = $('#service-modal');
    if (!modal) return;
    const img = $('#modal-image', modal);
    const title = $('#modal-title', modal);
    const formBox = $('#modal-form', modal);

    if (img) {
      // サービス詳細ページで設定された画像（detail-image）を優先、なければ image を使用
      const imgPath = data['detail-image'] || data.image || resolvePath('/images/service-300x200.svg');
      // 画像パスの処理: GitHub Pages対応
      img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
      img.onerror = function() {
        this.src = resolvePath('/images/service-300x200.svg');
      };
    }
    if (title) title.textContent = data.title || 'サービス詳細（ダミー）';

    // render dynamic form sections if provided
    // サービス詳細ページで編集した sections を使用（後方互換性のため forms もサポート）
    const sections = data.sections || data.forms || [];
    if (formBox) renderSections(formBox, sections, 'form');

    modal.classList.add('open');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('#service-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function openDetails(data) {
    const modal = $('#details-modal');
    if (!modal) return;
    const img = $('#details-modal-image', modal);
    const title = $('#details-modal-title', modal);
    const box = $('#details-form', modal);
    if (img) {
      // サービス詳細ページで設定された画像（detail-image）を優先、なければ image を使用
      const imgPath = data['detail-image'] || data.image || resolvePath('/images/service-300x200.svg');
      // 画像パスの処理: GitHub Pages対応
      img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
      img.onerror = function() {
        this.src = resolvePath('/images/service-300x200.svg');
      };
    }
    if (title) title.textContent = data.title || 'サービス詳細（ダミー）';
    // サービス詳細ページで編集した sections を使用（後方互換性のため details もサポート）
    // 注意: sections 配列の2番目以降のセクションを表示（1番目は service-modal で表示済み）
    const allSections = data.sections || [];
    const detailsSections = allSections.length > 1 ? allSections.slice(1) : (data.details || []);
    if (box) renderSections(box, detailsSections, 'detail');
    modal.classList.add('open');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDetails() {
    const modal = $('#details-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function openCartAdded(data) {
    const modal = $('#cart-added-modal');
    if (!modal) return;
    const img = $('#cart-added-item-image', modal);
    const title = $('#cart-added-item-title', modal);
    const details = $('#cart-added-item-details', modal);
    if (img) {
      const imgPath = data.image || resolvePath('/images/service-300x200.svg');
      // 画像パスの処理: GitHub Pages対応
      img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
      img.onerror = function() {
        this.src = resolvePath('/images/service-300x200.svg');
      };
    }
    if (title) title.textContent = data.title || 'サービス名';
    if (details) details.textContent = '選択内容: ダミー';
    modal.classList.add('open');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeCartAdded() {
    const modal = $('#cart-added-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function init() {
    // Splash Screen (index page, SP only)
    (function initSplash() {
      const splash = document.getElementById('splash-screen');
      const pageContent = document.getElementById('page-content');
      if (!splash) return; // Not on index page
      
      // Only run on mobile (max-width: 767.98px)
      const isMobile = window.innerWidth <= 767.98;
      if (!isMobile) {
        // PC: show content immediately, hide splash
        splash.style.display = 'none';
        if (pageContent) {
          pageContent.classList.remove('page-content-hidden');
          pageContent.classList.add('page-content-visible');
        }
        return;
      }
      
      // SP: show splash animation
      setTimeout(() => {
        splash.classList.add('hidden');
        if (pageContent) {
          pageContent.classList.remove('page-content-hidden');
          pageContent.classList.add('page-content-visible');
        }
        // Remove splash from DOM after animation completes
        setTimeout(() => {
          splash.remove();
        }, 500); // Match CSS transition duration
      }, 2000); // Total display time: 0.3s delay + 1s animation + 0.7s display = ~2s
    })();


    const modal = $('#service-modal');
    if (!modal) return;

    // Build dataset
    const raw = Array.isArray(window.SERVICE_ITEMS) ? window.SERVICE_ITEMS : [];
    const byId = new Map(raw.map(it => [String(it.id || ''), it]));
    // Expose minimal helpers for other pages (e.g., cart) without leaking internals
    try {
      window.Misesapo = window.Misesapo || {};
      window.Misesapo.openDetailsFor = function(id) {
        const it = byId.get(String(id));
        if (it) {
          openDetails(it);
        }
      };
    } catch (_) { /* no-op */ }

    // Service cards: let links navigate to detail pages (simpler approach)
    // Modal will be opened from the detail page if needed
    // No need to intercept card clicks - just let the links work naturally

    // Close buttons
    const closeBtn = $('#close-modal-btn', modal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const backBtn = $('#back-modal-btn', modal);
    if (backBtn) backBtn.addEventListener('click', closeModal);

    // Next → Details (ModalManagerを使用)
    const nextBtn = modal.querySelector('.actions .btn-primary');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const anyCard = document.querySelector('.card-service');
      const id = anyCard ? anyCard.getAttribute('data-id') : null;
      const match = id ? byId.get(String(id)) : null;
      const title = anyCard ? (anyCard.querySelector('h3')?.textContent || '') : '';
      const image = anyCard ? (anyCard.querySelector('img')?.getAttribute('src') || '') : '';
      const data = match || { title, image };
      closeModal();
      // ModalManagerを使用して次のモーダルを開く
      if (window.ModalManager) {
        window.ModalManager.open('details-modal', data);
      } else {
        openDetails(data);
      }
    });

    // Details modal events
    const details = $('#details-modal');
    if (details) {
      const closeD = $('#close-details-modal-btn', details);
      if (closeD) closeD.addEventListener('click', closeDetails);
      const backToService = $('#back-to-service-modal-btn', details);
      if (backToService) backToService.addEventListener('click', () => {
        closeDetails();
        const anyCard = document.querySelector('.card-service');
        const title = anyCard ? (anyCard.querySelector('h3')?.textContent || '') : '';
        const image = anyCard ? (anyCard.querySelector('img')?.getAttribute('src') || '') : '';
        openModal({ title, image });
      });
      // Next → Order modal
      const nextBtn = details.querySelector('.actions .btn-primary');
      if (nextBtn) nextBtn.addEventListener('click', () => {
        const anyCard = document.querySelector('.card-service');
        const id = anyCard ? anyCard.getAttribute('data-id') : null;
        const match = id ? byId.get(String(id)) : null;
        const title = anyCard ? (anyCard.querySelector('h3')?.textContent || '') : '';
        const image = anyCard ? (anyCard.querySelector('img')?.getAttribute('src') || '') : '';
        const data = match || { title, image };
        closeDetails();
        openOrder(data);
      });
      details.addEventListener('click', (e) => { if (e.target === details) closeDetails(); });
    }

    // Order modal functions
    function openOrder(data) {
      const modal = $('#order-modal');
      if (!modal) return;
      const img = $('#order-modal-image', modal);
      const title = $('#order-modal-title', modal);
      if (img) {
        const imgPath = data['detail-image'] || data.image || resolvePath('/images/service-300x200.svg');
        // 画像パスの処理: GitHub Pages対応
        img.src = imgPath.startsWith('http://') || imgPath.startsWith('https://') ? imgPath : resolvePath(imgPath.startsWith('/') ? imgPath : '/' + imgPath);
        img.onerror = function() {
          this.src = '/images/service-300x200.svg';
        };
      }
      if (title) title.textContent = data.title || 'サービス詳細（ダミー）';
      modal.classList.add('open');
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeOrder() {
      const modal = $('#order-modal');
      if (!modal) return;
      modal.classList.remove('open');
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }

    // Order modal events
    const order = $('#order-modal');
    if (order) {
      const closeO = $('#close-order-modal-btn', order);
      if (closeO) closeO.addEventListener('click', closeOrder);
      const backToDetails = $('#back-to-details-modal-btn', order);
      if (backToDetails) backToDetails.addEventListener('click', () => {
        const anyCard = document.querySelector('.card-service');
        const id = anyCard ? anyCard.getAttribute('data-id') : null;
        const match = id ? byId.get(String(id)) : null;
        const title = anyCard ? (anyCard.querySelector('h3')?.textContent || '') : '';
        const image = anyCard ? (anyCard.querySelector('img')?.getAttribute('src') || '') : '';
        const data = match || { title, image };
        closeOrder();
        openDetails(data);
      });
      const addToCart = $('#add-to-cart-btn', order);
      if (addToCart) addToCart.addEventListener('click', () => {
        const anyCard = document.querySelector('.card-service');
        const title = anyCard ? (anyCard.querySelector('h3')?.textContent || '') : '';
        const image = anyCard ? (anyCard.querySelector('img')?.getAttribute('src') || '') : '';
        closeOrder();
        openCartAdded({ title, image });
      });
      const setRegularOrder = $('#set-regular-order-btn', order);
      if (setRegularOrder) setRegularOrder.addEventListener('click', () => {
        // 定期発注の処理（将来実装）
        alert('定期発注機能は実装予定です');
      });
      order.addEventListener('click', (e) => { if (e.target === order) closeOrder(); });
    }

    // Cart added modal events
    const cartAdded = $('#cart-added-modal');
    if (cartAdded) {
      const closeC = $('#close-cart-added-modal-btn', cartAdded);
      if (closeC) closeC.addEventListener('click', closeCartAdded);
      const cont = $('#continue-shopping-btn', cartAdded);
      if (cont) cont.addEventListener('click', () => { closeCartAdded(); });
      cartAdded.addEventListener('click', (e) => { if (e.target === cartAdded) closeCartAdded(); });
    }

    // Click outside dialog closes
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // ESC closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Category filter tabs
    const tabContainer = document.querySelector('.tabs');
    if (tabContainer) {
      const tabs = $all('.tab', tabContainer);
      const cards = $all('.service-grid .card-service');
      function applyFilter(category) {
        cards.forEach((card) => {
          const c = (card.getAttribute('data-category') || '').trim();
          if (!category || category === 'all' || c === category) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      }
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.getAttribute('data-category') || 'all';
          applyFilter(cat);
        });
      });
      // default: show all
      applyFilter('all');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // リリース前チェックボックス管理
  (function() {
    // 現在のページパスを取得
    function getCurrentPagePath() {
      return window.location.pathname;
    }

    // localStorageからチェック状態を取得
    function getPageChecks(pagePath) {
      try {
        const stored = localStorage.getItem('releaseChecks');
        if (!stored) return { admin: false, developer: false, other: false };
        const allChecks = JSON.parse(stored);
        return allChecks[pagePath] || { admin: false, developer: false, other: false };
      } catch (e) {
        return { admin: false, developer: false, other: false };
      }
    }

    // localStorageにチェック状態を保存
    function savePageChecks(pagePath, checks) {
      try {
        const stored = localStorage.getItem('releaseChecks');
        const allChecks = stored ? JSON.parse(stored) : {};
        allChecks[pagePath] = checks;
        localStorage.setItem('releaseChecks', JSON.stringify(allChecks));
      } catch (e) {
        console.error('Failed to save release checks:', e);
      }
    }

    // ページ読み込み時にチェック状態を復元
    function initReleaseChecks() {
      const pagePath = getCurrentPagePath();
      const checks = getPageChecks(pagePath);

      const checkboxes = {
        admin: document.getElementById('check-admin'),
        developer: document.getElementById('check-developer'),
        other: document.getElementById('check-other')
      };

      if (checkboxes.admin) checkboxes.admin.checked = checks.admin;
      if (checkboxes.developer) checkboxes.developer.checked = checks.developer;
      if (checkboxes.other) checkboxes.other.checked = checks.other;

      // チェックボックス変更時に保存
      Object.keys(checkboxes).forEach(key => {
        const checkbox = checkboxes[key];
        if (checkbox) {
          checkbox.addEventListener('change', function() {
            const currentChecks = {
              admin: checkboxes.admin?.checked || false,
              developer: checkboxes.developer?.checked || false,
              other: checkboxes.other?.checked || false
            };
            savePageChecks(pagePath, currentChecks);
          });
        }
      });
    }

    // 全てのページのチェック状況を取得（サイトマップ用）
    window.Misesapo = window.Misesapo || {};
    window.Misesapo.getAllReleaseChecks = function() {
      try {
        const stored = localStorage.getItem('releaseChecks');
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        return {};
      }
    };

    // ページ読み込み時に初期化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initReleaseChecks);
    } else {
      initReleaseChecks();
    }
  })();
})();
