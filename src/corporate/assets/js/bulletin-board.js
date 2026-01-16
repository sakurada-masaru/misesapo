// 意見交換掲示板 - JavaScript

// ローカルストレージのキー
const STORAGE_KEY = 'bulletin_board_posts';

// 投稿データの管理
let posts = [];

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    setupForm();
    renderPosts();
});

// 投稿を読み込む
function loadPosts() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            posts = JSON.parse(stored);
        } catch (e) {
            console.error('投稿データの読み込みに失敗しました:', e);
            posts = [];
        }
    }
}

// 投稿を保存する
function savePosts() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch (e) {
        console.error('投稿データの保存に失敗しました:', e);
        alert('投稿の保存に失敗しました。ブラウザのストレージ容量を確認してください。');
    }
}

// フォームの設定
function setupForm() {
    const form = document.getElementById('post-form');
    form.addEventListener('submit', handlePostSubmit);
}

// 投稿フォームの送信処理
function handlePostSubmit(e) {
    e.preventDefault();

    const authorName = document.getElementById('author-name').value.trim();
    const postTitle = document.getElementById('post-title').value.trim();
    const postContent = document.getElementById('post-content').value.trim();

    if (!authorName || !postTitle || !postContent) {
        alert('すべての項目を入力してください。');
        return;
    }

    // 新しい投稿を作成
    const newPost = {
        id: Date.now().toString(),
        author: authorName,
        title: postTitle,
        content: postContent,
        date: new Date().toISOString(),
        comments: []
    };

    // 投稿を追加
    posts.unshift(newPost); // 最新の投稿を先頭に
    savePosts();
    renderPosts();

    // フォームをリセット
    document.getElementById('post-form').reset();

    // 投稿成功のアニメーション
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.innerHTML = '<i class="fas fa-check"></i> 投稿完了！';
    submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
    
    setTimeout(() => {
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 投稿する';
        submitBtn.style.background = 'linear-gradient(135deg, var(--primary-pink) 0%, var(--primary-pink-light) 100%)';
    }, 2000);
}

// 投稿一覧を描画
function renderPosts() {
    const container = document.getElementById('posts-container');
    const countElement = document.getElementById('posts-count');

    // 投稿数を更新
    countElement.textContent = `投稿数: ${posts.length}`;

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>まだ投稿がありません</p>
                <p class="empty-state-sub">最初の投稿をしてみましょう！</p>
            </div>
        `;
        return;
    }

    // 投稿カードを生成
    container.innerHTML = posts.map(post => createPostCard(post)).join('');

    // コメントフォームのイベントリスナーを設定
    posts.forEach(post => {
        setupCommentForm(post.id);
    });
}

// 投稿カードのHTMLを生成
function createPostCard(post) {
    const date = new Date(post.date);
    const formattedDate = formatDate(date);
    const authorInitial = post.author.charAt(0).toUpperCase();
    const commentsHtml = post.comments.map(comment => createCommentHtml(comment)).join('');

    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">${authorInitial}</div>
                    <div class="author-info">
                        <div class="author-name">${escapeHtml(post.author)}</div>
                        <div class="post-date">${formattedDate}</div>
                    </div>
                </div>
            </div>
            <h3 class="post-title">${escapeHtml(post.title)}</h3>
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="comments-section">
                <div class="comments-header">
                    <i class="fas fa-comments"></i>
                    コメント (${post.comments.length})
                </div>
                <div class="comment-form" data-post-id="${post.id}">
                    <div class="comment-input-group">
                        <input 
                            type="text" 
                            class="comment-author-input" 
                            placeholder="お名前" 
                            data-comment-author="${post.id}"
                            required
                        >
                        <textarea 
                            class="comment-text-input" 
                            placeholder="コメントを入力..." 
                            data-comment-text="${post.id}"
                            required
                        ></textarea>
                    </div>
                    <button type="button" class="comment-submit-btn" onclick="handleCommentSubmit('${post.id}')">
                        <i class="fas fa-reply"></i>
                        コメントする
                    </button>
                </div>
                <div class="comments-list" data-comments-list="${post.id}">
                    ${commentsHtml}
                </div>
            </div>
        </div>
    `;
}

// コメントのHTMLを生成
function createCommentHtml(comment) {
    const date = new Date(comment.date);
    const formattedDate = formatDate(date);

    return `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-author">${escapeHtml(comment.author)}</div>
                <div class="comment-date">${formattedDate}</div>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
        </div>
    `;
}

// コメントフォームの設定
function setupCommentForm(postId) {
    const form = document.querySelector(`.comment-form[data-post-id="${postId}"]`);
    if (form) {
        const textarea = form.querySelector(`textarea[data-comment-text="${postId}"]`);
        if (textarea) {
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleCommentSubmit(postId);
                }
            });
        }
    }
}

// コメントの送信処理
function handleCommentSubmit(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const authorInput = document.querySelector(`input[data-comment-author="${postId}"]`);
    const textInput = document.querySelector(`textarea[data-comment-text="${postId}"]`);

    if (!authorInput || !textInput) return;

    const author = authorInput.value.trim();
    const content = textInput.value.trim();

    if (!author || !content) {
        alert('お名前とコメントを入力してください。');
        return;
    }

    // コメントを追加
    const newComment = {
        id: Date.now().toString(),
        author: author,
        content: content,
        date: new Date().toISOString()
    };

    post.comments.push(newComment);
    savePosts();
    renderPosts();
}

// 日付をフォーマット
function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
        return 'たった今';
    } else if (minutes < 60) {
        return `${minutes}分前`;
    } else if (hours < 24) {
        return `${hours}時間前`;
    } else if (days < 7) {
        return `${days}日前`;
    } else {
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

