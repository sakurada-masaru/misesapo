// Modal Flow Manager
// モーダルの流れをテンプレート化して管理

(function() {
  'use strict';

  let modalConfig = null;
  let currentModalData = null;

  // モーダル設定を読み込む
  async function loadModalConfig() {
    try {
      const response = await fetch('/data/modal_flow.json');
      modalConfig = await response.json();
      return modalConfig;
    } catch (error) {
      console.error('Failed to load modal config:', error);
      return null;
    }
  }

  // モーダルを開く（汎用関数）
  function openModalById(modalId, data) {
    if (!modalConfig) {
      console.error('Modal config not loaded');
      return;
    }

    const modalDef = modalConfig.modals.find(m => m.id === modalId);
    if (!modalDef) {
      console.error(`Modal ${modalId} not found in config`);
      return;
    }

    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error(`Modal element ${modalId} not found`);
      return;
    }

    // dataが渡されていない場合は、currentModalDataを使用（モーダル間の遷移時）
    const modalData = data || currentModalData || {};
    currentModalData = modalData;

    // 画像を設定
    if (modalDef.imageId) {
      const img = document.getElementById(modalDef.imageId);
      if (img && modalData) {
        const imgPath = modalData['detail-image'] || modalData.image || '/images/service-300x200.svg';
        // 画像パスの処理: http/https で始まる場合はそのまま、/で始まる場合はそのまま、それ以外は / を追加
        let finalPath;
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
          finalPath = imgPath;
        } else if (imgPath.startsWith('/')) {
          finalPath = imgPath;
        } else {
          finalPath = '/' + imgPath;
        }
        img.src = finalPath;
        img.onerror = function() {
          console.error('[ModalManager] Image load error:', this.src);
          this.src = '/images/service-300x200.svg';
        };
      } else {
        console.warn('[ModalManager] Image element not found or no data:', {
          imageId: modalDef.imageId,
          imgFound: !!img,
          dataFound: !!modalData
        });
      }
    }

    // タイトルを設定
    if (modalDef.titleId) {
      const title = document.getElementById(modalDef.titleId);
      if (title && modalData) {
        title.textContent = modalData.title || modalDef.title || 'サービス詳細（ダミー）';
      }
    }

    // フォームコンテナにセクションをレンダリング
    if (modalDef.formContainerId && modalDef.formDataKey && modalData) {
      const formContainer = document.getElementById(modalDef.formContainerId);
      if (formContainer && window.renderSections) {
        const formData = modalData[modalDef.formDataKey] || [];
        window.renderSections(formContainer, formData, modalDef.formDataKey === 'forms' ? 'form' : 'detail');
      }
    }

    // モーダルを表示
    modal.classList.remove('hidden');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // モーダルが表示された後に画像を再設定（DOMが完全に読み込まれたことを確認）
    setTimeout(() => {
      if (modalDef.imageId) {
        const img = document.getElementById(modalDef.imageId);
        if (img && modalData) {
          const imgPath = modalData['detail-image'] || modalData.image || '/images/service-300x200.svg';
          let finalPath;
          if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
            finalPath = imgPath;
          } else if (imgPath.startsWith('/')) {
            finalPath = imgPath;
          } else {
            finalPath = '/' + imgPath;
          }
          img.src = finalPath;
        }
      }
    }, 100);
  }

  // モーダルを閉じる
  function closeModalById(modalId, preserveData = false) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('open');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    // モーダル間の遷移時はデータを保持する
    if (!preserveData) {
      currentModalData = null;
    }
  }

  // ボタンアクションを処理
  function handleButtonAction(buttonDef, modalId) {
    switch (buttonDef.action) {
      case 'navigate':
        if (buttonDef.target) {
          // モーダル間の遷移時はデータを保持する
          closeModalById(modalId, true);
          // 少し遅延を入れてから次のモーダルを開く（アニメーション用）
          setTimeout(() => {
            if (buttonDef.target === 'cart-added-modal') {
              // cart-added-modalは特別な処理
              if (window.openCartAdded) {
                const anyCard = document.querySelector('.card-service');
                const title = anyCard ? (anyCard.querySelector('h3')?.textContent || '') : '';
                const image = anyCard ? (anyCard.querySelector('img')?.getAttribute('src') || '') : '';
                window.openCartAdded({ title, image });
              }
            } else {
              // currentModalDataを明示的に渡す
              openModalById(buttonDef.target, currentModalData);
            }
          }, 150);
        }
        break;
      case 'close':
        closeModalById(modalId);
        break;
      case 'custom':
        if (buttonDef.handler && window[buttonDef.handler]) {
          window[buttonDef.handler](currentModalData);
        } else {
          console.warn(`Custom handler ${buttonDef.handler} not found`);
        }
        break;
      default:
        console.warn(`Unknown action: ${buttonDef.action}`);
    }
  }

  // モーダルのイベントリスナーを設定
  function setupModalListeners() {
    if (!modalConfig) return;

    modalConfig.modals.forEach(modalDef => {
      const modal = document.getElementById(modalDef.id);
      if (!modal) return;

      // 閉じるボタン
      const closeBtn = modal.querySelector(`#close-${modalDef.id}-btn`);
      if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModalById(modalDef.id));
      }

      // 背景クリックで閉じる
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModalById(modalDef.id);
        }
      });

      // ボタンのイベントリスナー
      modalDef.buttons.forEach(buttonDef => {
        // ボタンIDで検索
        let button = document.getElementById(buttonDef.id);
        if (!button) {
          // ボタンが見つからない場合、テキストで検索（フォールバック）
          const buttons = modal.querySelectorAll('button');
          button = Array.from(buttons).find(btn => {
            const text = btn.textContent.trim();
            return text === buttonDef.text || text.includes(buttonDef.text);
          });
        }
        if (button) {
          // 既存のイベントリスナーを削除してから追加（重複防止）
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);
          newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleButtonAction(buttonDef, modalDef.id);
          });
        } else {
          console.warn(`Button ${buttonDef.id} not found in modal ${modalDef.id}`);
        }
      });
    });
  }

  // 初期化
  async function init() {
    await loadModalConfig();
    setupModalListeners();
  }

  // カスタムハンドラー関数
  window.setRegularOrder = function(data) {
    // 定期発注の処理（将来実装）
    alert('定期発注機能は実装予定です');
  };

  // グローバルAPIを公開
  window.ModalManager = {
    open: openModalById,
    close: closeModalById,
    init: init,
    getConfig: () => modalConfig,
    getCurrentData: () => currentModalData
  };

  // DOMContentLoaded時に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

