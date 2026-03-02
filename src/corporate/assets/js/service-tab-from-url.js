/**
 * サービス一覧ページで URL の ?category= または #category= を読み、
 * 該当するタブをアクティブにしてカードをフィルタする。
 * index.html のカテゴリリンクから service/service.html に遷移したときに使用。
 */
(function () {
  function getCategoryFromUrl() {
    var params = new URLSearchParams(window.location.search || '');
    var fromQuery = params.get('category');
    if (fromQuery) return fromQuery;
    var hash = window.location.hash || '';
    if (hash.indexOf('category=') !== -1) {
      var m = hash.match(/category=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }
    return '';
  }

  function init() {
    var tabContainer = document.querySelector('.tabs');
    if (!tabContainer) return;

    var tabs = tabContainer.querySelectorAll('.tab');
    var cards = document.querySelectorAll('.service-grid .card-service');
    if (!tabs.length || !cards.length) return;

    var category = getCategoryFromUrl();
    if (!category) return;

    var targetTab = null;
    for (var i = 0; i < tabs.length; i++) {
      var c = (tabs[i].getAttribute('data-category') || '').trim();
      if (c === category) {
        targetTab = tabs[i];
        break;
      }
    }
    if (!targetTab) return;

    // タブの active を切り替え
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].classList.remove('active');
    }
    targetTab.classList.add('active');

    // カードの表示・非表示
    for (var k = 0; k < cards.length; k++) {
      var card = cards[k];
      var cardCat = (card.getAttribute('data-category') || '').trim();
      if (category === 'all' || cardCat === category) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
