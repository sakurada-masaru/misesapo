/**
 * ContextManager
 * 業務コンテキスト（ワークスペースモード）の管理を行う
 */

export const MODES = {
    ADMIN: {
        id: 'admin',
        label: 'Administration',
        jp_label: '管理モード',
        icon: 'fas fa-shield-alt',
        theme: 'theme-admin', // Black/Dark Base
        description: '全権限を持つコマンドセンター',
        sidebar_config: 'full'
    },
    OFFICE: {
        id: 'office',
        label: 'Office Work',
        jp_label: '事務モード',
        icon: 'fas fa-file-invoice',
        theme: 'theme-blue', // Calm Blue
        description: 'バックオフィス業務・ドキュメント作成',
        sidebar_config: ['dashboard', 'reports', 'estimates', 'zaiko', 'wiki']
    },
    SALES: {
        id: 'sales',
        label: 'Sales & Field',
        jp_label: '営業モード',
        icon: 'fas fa-briefcase',
        theme: 'theme-orange', // Active Orange
        description: '顧客対応・外回り・スケジュール',
        sidebar_config: ['schedules', 'customers', 'announcements', 'reports']
    },
    OPERATIONS: {
        id: 'operations',
        label: 'Operations',
        jp_label: '現場モード',
        icon: 'fas fa-hard-hat',
        theme: 'theme-green', // Safety Green
        description: '現場作業・報告・チェックリスト',
        sidebar_config: ['attendance', 'reports', 'manuals']
    }
};

export class ContextManager {
    constructor() {
        this.currentMode = null;
        this.user = null;
    }

    /**
     * 初期化
     * @param {Object} user - CognitoUserオブジェクト
     */
    init(user) {
        this.user = user;
        // 以前のモードを復元、なければ権限に基づくデフォルト
        const savedMode = localStorage.getItem('current_mode');
        if (savedMode && this.isModeAllowed(savedMode)) {
            this.switchMode(savedMode);
        } else {
            // デフォルト決定ロジック
            this.switchMode(this.getDefaultModeForUser());
        }
    }

    /**
     * ユーザーが利用可能なモードリストを取得
     */
    getAvailableModes() {
        // ロールに基づくフィルタリング
        const role = window.CognitoAuth.getUserRole(this.user);
        const modes = [];

        // 管理者・マスターは全モード使用可能
        if (role === 'admin' || role === 'headquarters' || role === 'developer') {
            return [MODES.ADMIN, MODES.OFFICE, MODES.SALES, MODES.OPERATIONS];
        }

        // 事務職
        if (role === 'office') {
            return [MODES.OFFICE, MODES.OPERATIONS]; // 稀に現場もありうる
        }

        // 営業職
        if (role === 'sales') {
            return [MODES.SALES, MODES.OFFICE, MODES.OPERATIONS];
        }

        // 現場・清掃など
        if (role === 'cleaner' || role === 'staff') {
            return [MODES.OPERATIONS];
        }

        // デフォルトフォールバック
        return [MODES.OPERATIONS];
    }

    /**
     * 特定のモードが許可されているかチェック
     */
    isModeAllowed(modeId) {
        const available = this.getAvailableModes();
        return available.some(m => m.id === modeId);
    }

    /**
     * デフォルトモードを決定
     */
    getDefaultModeForUser() {
        const role = window.CognitoAuth.getUserRole(this.user);
        if (role === 'admin' || role === 'headquarters' || role === 'developer') return 'admin';
        if (role === 'office') return 'office';
        if (role === 'sales') return 'sales';
        return 'operations';
    }

    /**
     * モード切り替え実行
     */
    switchMode(modeId) {
        if (!this.isModeAllowed(modeId)) {
            console.warn(`Mode ${modeId} is not allowed for this user.`);
            return;
        }

        console.log(`Switching Context to: ${modeId}`);
        const mode = Object.values(MODES).find(m => m.id === modeId);

        this.currentMode = mode;
        localStorage.setItem('current_mode', modeId);

        // UIへの反映（イベント発火）
        const event = new CustomEvent('context-changed', { detail: mode });
        window.dispatchEvent(event);

        // テーマカラーの適用（CSS変数やクラスの書き換え）
        this.applyTheme(mode.theme);

        // サイドバーの再構築指示（別途SidebarManagerがリッスンすることを想定）
        this.updateSidebar(mode.sidebar_config);
    }

    /**
     * テーマ適用
     */
    applyTheme(themeClass) {
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(themeClass);

        // CSS変数の動的書き換え例
        const root = document.documentElement;
        switch (themeClass) {
            case 'theme-admin':
                root.style.setProperty('--accent-color', '#3b82f6'); // Blue
                break;
            case 'theme-blue':
                root.style.setProperty('--accent-color', '#0ea5e9'); // Sky
                break;
            case 'theme-orange':
                root.style.setProperty('--accent-color', '#f97316'); // Orange
                break;
            case 'theme-green':
                root.style.setProperty('--accent-color', '#10b981'); // Emerald
                break;
        }
    }

    /**
     * サイドバー更新（簡易実装）
     * 本来はSidebarManagerが行うべきだが、一旦ここでDOM操作する
     */
    updateSidebar(config) {
        // configが 'full' なら何もしない（全部表示）
        // 配列なら、そのIDを持つ要素以外を非表示にするなどの処理
        // （DOM構造依存のため、entrance.html側でイベントをリッスンして処理する方が疎結合で良い）
    }
}

// シングルトンとして公開
export const contextManager = new ContextManager();
window.ContextManager = contextManager; // グローバルアクセス用
