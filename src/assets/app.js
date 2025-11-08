// Minimal modal wiring for service items (dummy data OK)
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function renderSections(container, sections, namePrefix) {
    if (!container) return;
    clear(container);
    const forms = sections || [];
    forms.forEach((sec, idx) => {
      const wrap = document.createElement('div');
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
          // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
          if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
            img.src = imgPath;
          } else if (imgPath.startsWith('/')) {
            img.src = imgPath;
          } else {
            img.src = '/' + imgPath;
          }
          img.alt = (it['text'] || '');
          img.onerror = function() {
            this.src = '/images/service-300x200.svg';
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
          const imgPath = it['img-url'] || it['img'] || '/images/service-300x200.svg';
          // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
          if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
            img.src = imgPath;
          } else if (imgPath.startsWith('/')) {
            img.src = imgPath;
          } else {
            img.src = '/' + imgPath;
          }
          img.alt = (it['text'] || '');
          img.onerror = function() {
            this.src = '/images/service-300x200.svg';
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
      const imgPath = data['detail-image'] || data.image || '/images/service-300x200.svg';
      // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        img.src = imgPath;
      } else if (imgPath.startsWith('/')) {
        img.src = imgPath;
      } else {
        img.src = '/' + imgPath;
      }
      img.onerror = function() {
        this.src = '/images/service-300x200.svg';
      };
    }
    if (title) title.textContent = data.title || 'サービス詳細（ダミー）';

    // render dynamic form sections if provided
    // サービス詳細ページで編集した forms を使用
    if (formBox) renderSections(formBox, data.forms || [], 'form');

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
      const imgPath = data['detail-image'] || data.image || '/images/service-300x200.svg';
      // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        img.src = imgPath;
      } else if (imgPath.startsWith('/')) {
        img.src = imgPath;
      } else {
        img.src = '/' + imgPath;
      }
      img.onerror = function() {
        this.src = '/images/service-300x200.svg';
      };
    }
    if (title) title.textContent = data.title || 'サービス詳細（ダミー）';
    // サービス詳細ページで編集した details を使用
    if (box) renderSections(box, data.details || [], 'detail');
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
      const imgPath = data.image || '/images/service-300x200.svg';
      // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        img.src = imgPath;
      } else if (imgPath.startsWith('/')) {
        img.src = imgPath;
      } else {
        img.src = '/' + imgPath;
      }
      img.onerror = function() {
        this.src = '/images/service-300x200.svg';
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

    // Off-canvas (swipe + hamburger button)
    (function initOffcanvas(){
      const panel = document.getElementById('offcanvas');
      const overlay = document.getElementById('offcanvas-overlay');
      const toggle = document.querySelector('.nav-toggle');
      const swipeHint = document.querySelector('.edge-swipe-hint');
      if (!panel || !overlay) return;
      const open = () => {
        panel.classList.add('open');
        overlay.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        // Hide swipe hint when panel opens
        if (swipeHint) swipeHint.classList.add('hidden');
      };
      const close = () => {
        panel.classList.remove('open');
        overlay.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('aria-hidden', 'true');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        // Show swipe hint again when panel closes (after delay, SP only)
        if (swipeHint && window.innerWidth <= 767.98) {
          setTimeout(() => {
            swipeHint.classList.remove('hidden');
          }, 500);
        }
      };
      overlay.addEventListener('click', close);
      // Click on the swipe hint opens the panel (especially for SP)
      if (swipeHint) {
        swipeHint.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!panel.classList.contains('open')) open();
        });
      }
      
      // Hamburger button to open/close
      if (toggle) {
        toggle.addEventListener('click', () => {
          if (panel.classList.contains('open')) close(); else open();
        });
      }
      
      // Close on nav link click
      const navLinks = panel.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', close);
      });

      let startX = 0;
      let tracking = false; // 'open' | 'close' | false
      let touchId = null;
      const EDGE = 50; // px from left edge to begin open gesture
      const THRESHOLD = 40; // px to trigger action

      window.addEventListener('touchstart', (e) => {
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        if (!t) return;
        const x = t.clientX;
        if (!panel.classList.contains('open') && x <= EDGE) { tracking = 'open'; startX = x; touchId = t.identifier; }
        else if (panel.classList.contains('open')) { tracking = 'close'; startX = x; touchId = t.identifier; }
      }, { passive: true });

      window.addEventListener('touchend', (e) => {
        if (touchId === null) return;
        let t = null;
        for (const ct of e.changedTouches) { if (ct.identifier === touchId) { t = ct; break; } }
        if (!t) return;
        const dx = t.clientX - startX;
        if (tracking === 'open' && dx > THRESHOLD) open();
        if (tracking === 'close' && dx < -THRESHOLD) close();
        tracking = false; touchId = null;
      }, { passive: true });

      // ESC to close for accessibility
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
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

    // Open on any service card click (dummy OK)
    // If card has a link, let it navigate; otherwise open modal
    $all('.card-service').forEach((card) => {
      const link = card.querySelector('.card-service-link');
      if (link) {
        // Card has a link, let it navigate to the service page
        return;
      }
      // No link, open modal (for backward compatibility)
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const match = id ? byId.get(String(id)) : null;
        // Derive fallback data
        const titleEl = card.querySelector('h3');
        const imgEl = card.querySelector('img');
        const fallback = {
          title: titleEl ? titleEl.textContent.trim() : 'サービス詳細（ダミー）',
          image: imgEl ? imgEl.getAttribute('src') : '/images/service-300x200.svg',
        };
        openModal(match || fallback);
      });
    });

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
        const imgPath = data['detail-image'] || data.image || '/images/service-300x200.svg';
        // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
          img.src = imgPath;
        } else if (imgPath.startsWith('/')) {
          img.src = imgPath;
        } else {
          img.src = '/' + imgPath;
        }
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
