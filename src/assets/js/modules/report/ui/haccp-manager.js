
/**
 * HaccpManager
 * Handles HACCP-related fields (work type, anomaly, reviewer, etc.) within cleaning items.
 */
export class HaccpManager {
    constructor(stateManager) {
        this.state = stateManager;

        this.HACCP_CONFIG = [
            {
                category: '排水・油脂管理',
                items: [
                    { id: 'h-grease', name: 'グリストラップ', options: ['清掃', '汚泥除去', '分解', '非分解'] },
                    { id: 'h-gutter', name: 'U字溝・グレーチング', options: ['清掃'] },
                    { id: 'h-pipe', name: '配管', options: ['高圧洗浄', '内部'] }
                ]
            },
            {
                category: '換気・排気設備',
                items: [
                    { id: 'h-hood', name: 'レンジフード', options: ['洗浄', '分解'] },
                    { id: 'h-duct', name: 'ダクト', options: ['洗浄', '内部'] },
                    { id: 'h-shutter', name: '防火シャッター', options: ['清掃'] },
                    { id: 'h-fan', name: '換気扇', options: ['洗浄'] },
                    { id: 'h-exhaust-fan', name: '排気ファン', options: ['清掃', '分解'] },
                    { id: 'h-belt', name: '排気ファンベルト', options: ['交換', '調整', '保守'] }
                ]
            },
            {
                category: '厨房・調理関連設備',
                items: [
                    { id: 'h-kitchen-equip', name: '厨房機器', options: ['洗浄', '分解'] },
                    { id: 'h-wall-kitchen', name: '壁（厨房）', options: ['清掃'] },
                    { id: 'h-sink', name: 'シンク', options: ['洗浄'] }
                ]
            },
            {
                category: '空調設備',
                items: [
                    { id: 'h-ac-filter', name: 'エアコンフィルター', options: ['洗浄'] },
                    { id: 'h-ac-body', name: 'エアコン本体', options: ['分解洗浄', '内部'] }
                ]
            },
            {
                category: '床・フロア',
                items: [
                    { id: 'h-floor', name: '床（フロア）', options: ['清掃', '除菌', '保護'] },
                    { id: 'h-flooring', name: 'フローリング', options: ['清掃'] },
                    { id: 'h-tile', name: 'タイル', options: ['清掃'] },
                    { id: 'h-carpet', name: 'カーペット', options: ['清掃'] },
                    { id: 'h-wax', name: 'ワックスがけ', options: ['実施'] },
                    { id: 'h-coating', name: 'コーティング', options: ['処理'] }
                ]
            },
            {
                category: '共用部・その他',
                items: [
                    { id: 'h-window', name: '窓', options: ['清掃'] },
                    { id: 'h-door', name: 'ドア', options: ['清掃'] },
                    { id: 'h-light', name: '照明器具', options: ['清掃'] },
                    { id: 'h-vent-hole', name: '換気口', options: ['清掃'] },
                    { id: 'h-toilet', name: 'トイレ', options: ['清掃'] },
                    { id: 'h-handwash', name: '手洗い場', options: ['清掃'] },
                    { id: 'h-mirror', name: '鏡', options: ['清掃'] },
                    { id: 'h-wall', name: '壁面', options: ['清掃'] },
                    { id: 'h-ceiling', name: '天井', options: ['清掃'] },
                    { id: 'h-elevator', name: 'エレベーター', options: ['清掃'] },
                    { id: 'h-stairs', name: '階段', options: ['清掃'] },
                    { id: 'h-trash', name: 'ゴミ箱', options: ['清掃'] }
                ]
            },
            {
                category: '害虫防除',
                items: [
                    { id: 'h-pest-roach', name: 'ゴキブリ/チョウバエ駆除', options: ['駆除', '防除施工', '調査'] },
                    { id: 'h-pest-rat', name: 'ネズミ駆除', options: ['駆除', '防除施工', '調査'] },
                    { id: 'h-pest-all', name: '害虫駆除', options: ['駆除', '防除施工'] }
                ]
            }
        ];
    }

    /**
     * Determines the HACCP configuration for a given item name.
     * @param {string} itemName 
     * @returns {Object|null} { item, category } or fallback object
     */
    getHaccpConfig(itemName) {
        if (!itemName) return null;

        for (const cat of this.HACCP_CONFIG) {
            // Partial match for robustness (e.g. "エアコンフィルター洗浄" matches "エアコンフィルター")
            // But prefer exact match if possible, or "includes" logic
            const item = cat.items.find(it => itemName.includes(it.name));
            if (item) {
                return { item, category: cat.category };
            }
        }

        // Fallback for items that need consistent form fields but aren't strictly in the config
        return {
            item: {
                id: null, // No specific ID
                name: itemName,
                options: ['清掃', '点検', '交換', 'その他']
            },
            category: '' // No specific category
        };
    }

    /**
     * Generates the HTML for the HACCP form fields.
     */
    renderHaccpFields(sectionId, itemName, currentData = {}) {
        const config = this.getHaccpConfig(itemName);
        if (!config) return '';

        const item = config.item;
        const isPestControl = config.category === '害虫防除';

        // Data extraction
        const savedWorkType = currentData.work_type;
        const savedAbnormal = currentData.abnormal;
        const savedCorrection = currentData.correction || '';
        // Default to current user if not saved, otherwise empty string
        const currentUser = window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : '';
        const savedConfirmer = currentData.confirmer || currentUser || '';
        const savedNextDate = currentData.next_date || '';

        const headerHtml = config.category ?
            `<div class="haccp-smart-header" style="font-size:0.85rem; color:#ec4899; margin-bottom:8px; font-weight:bold; border-bottom:1px solid #fdf2f8; padding-bottom:4px;">${config.category}</div>` : '';

        // Radio buttons for Work Content
        const optionsHtml = (item.options || ['清掃']).map((opt, idx) => {
            const isChecked = savedWorkType ? (savedWorkType === opt) : (idx === 0);
            return `
                <label style="display:flex; align-items:center; background:white; padding:6px 10px; border:1px solid #d1d5db; border-radius:14px; font-size:0.85rem; cursor:pointer;">
                    <input type="radio" name="sect-${sectionId}-opt" value="${opt}" ${isChecked ? 'checked' : ''} onchange="window.handleHaccpChange('${sectionId}', 'work_type', this.value)" style="margin-right:6px;"> ${opt}
                </label>
            `;
        }).join('');

        // Abnormality Check (Using dynamic radio buttons)
        const checkOptions = isPestControl ? ['生息なし', '生息あり(少量)', '生息あり(多量)', '死骸確認', 'その他'] : ['異常なし', '破損', '汚損', '異音', '水漏れ', '詰まり', 'その他'];
        const labelText = isPestControl ? '生息状況・調査結果' : '異常の有無・状態';

        const checkOptionsHtml = checkOptions.map((opt, idx) => {
            const isChecked = savedAbnormal ? (savedAbnormal === opt) : (idx === 0);
            return `
                <label style="display:flex; align-items:center; background:white; padding:6px 10px; border:1px solid #d1d5db; border-radius:14px; font-size:0.85rem; cursor:pointer;">
                    <input type="radio" name="sect-${sectionId}-check" value="${opt}" ${isChecked ? 'checked' : ''} onchange="window.handleHaccpChange('${sectionId}', 'abnormal', this.value)" style="margin-right:6px;"> ${opt}
                </label>
             `;
        }).join('');

        return `
            <div class="haccp-fields-area" style="background:#fff; border-radius:6px; padding:10px;">
                ${headerHtml}
                
                <!-- Work Content -->
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.75rem; color:#ec4899; margin-bottom:4px;">作業内容</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${optionsHtml}
                    </div>
                </div>

                <!-- Abnormality/Status Check -->
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.75rem; color:#ec4899; margin-bottom:4px;">${labelText}</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${checkOptionsHtml}
                    </div>
                </div>

                <!-- Correction / Remarks -->
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.75rem; color:#ec4899; margin-bottom:4px;">処置内容・備考</div>
                    <textarea class="form-input" placeholder="処置内容や特記事項を入力" 
                        onchange="window.handleHaccpChange('${sectionId}', 'correction', this.value)"
                        style="min-height:40px; font-size:0.9rem;">${this._escape(savedCorrection)}</textarea>
                </div>

                <!-- Confirmer & Next Date -->
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <div style="font-size:0.75rem; color:#ec4899; margin-bottom:4px;">確認者名</div>
                        <input type="text" class="form-input" placeholder="確認者名" value="${this._escape(savedConfirmer)}"
                             onchange="window.handleHaccpChange('${sectionId}', 'confirmer', this.value)" style="font-size:0.9rem;">
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:0.75rem; color:#ec4899; margin-bottom:4px;">次回実施予定日</div>
                        <input type="date" class="form-input" value="${this._escape(savedNextDate)}"
                             onchange="window.handleHaccpChange('${sectionId}', 'next_date', this.value)" style="font-size:0.9rem;">
                    </div>
                </div>
            </div>
        `;
    }

    _escape(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

    // Since we're using inline 'onchange' handlers for simplicity in this generated HTML,
    // we need to expose a global handler or bind generic events.
    // For module purity, it's better to attach events after rendering, but sticking to inline for speed prototyping
    // requires a global bridge.
    // I will setup the bridge in index.js.
}
