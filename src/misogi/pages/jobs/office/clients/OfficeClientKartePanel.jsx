/**
 * 事務・顧客リスト用 清掃カルテ詳細パネル
 * 店舗IDに紐づくカルテは karteTemplate / karteStorage で存在保証し、表示・保存する。
 */
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { PLAN_FREQUENCY_OPTIONS } from './karteTemplate';
import { ensureKarteExists, saveKarte } from './karteStorage';

const EQUIPMENT_OPTIONS = ['空調', 'ダクト', 'レンジフード', 'グリストラップ', '床', '排水溝', 'トイレ', '窓・ガラス'];
const STAFF_ROOM_OPTIONS = ['あり', 'なし', '不明'];
const PLAN_SELECT_OPTIONS = ['毎月', '隔月', '3ヶ月', '6ヶ月', '年1', 'スポット', '未定'];
const SELF_RATING_OPTIONS = ['良い', '普通', '要改善', '未評価'];

const FALLBACK_SERVICE_ITEMS = [
  { id: 1, title: 'グリストラップ', category: '厨房設備' },
  { id: 2, title: 'U字溝・グレーチング清掃', category: '厨房設備' },
  { id: 3, title: '配管高圧洗浄', category: '厨房設備' },
  { id: 4, title: 'レンジフード洗浄', category: '厨房設備' },
  { id: 5, title: 'ダクト洗浄', category: '厨房設備' },
  { id: 6, title: 'エアコンフィルター洗浄', category: '空調設備' },
  { id: 7, title: '窓清掃', category: 'フロア' },
  { id: 8, title: 'トイレ洗浄', category: 'フロア' },
  { id: 9, title: '床清掃', category: 'フロア' },
  { id: 10, title: 'HACCP', category: 'その他' },
];

const OfficeClientKartePanel = forwardRef(function OfficeClientKartePanel({ storeId, store, brands = [], clients = [], getBrandName, getClientName, onBack, isLocked = false }, ref) {
  const [karte, setKarte] = useState(() => ensureKarteExists(storeId, store || {}));
  const [serviceItems, setServiceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consumableName, setConsumableName] = useState('');
  const [consumableQuantity, setConsumableQuantity] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffStartDate, setStaffStartDate] = useState('');
  const isInitialLoadRef = useRef(true);
  const lastSavedKarteRef = useRef(null);

  const safeStore = store || {};
  const brandName = (safeStore && getBrandName) ? getBrandName(safeStore) : (safeStore.brand_name ?? ((brands.find(b => String(b.id) === String(safeStore.brand_id))?.name) ?? ''));
  const clientName = (safeStore && getClientName) ? getClientName(safeStore) : (safeStore.client_name ?? ((clients.find(c => String(c.id) === String(safeStore.client_id))?.name) ?? safeStore.company_name ?? ''));
  const address = (safeStore.address ?? [safeStore.postcode, safeStore.pref, safeStore.city, safeStore.address1, safeStore.address2].filter(Boolean).join(' ')) || '';

  const loadKarte = useCallback(() => {
    try {
      const data = ensureKarteExists(storeId, store || {});
      setKarte(data);
    } catch (e) {
      console.warn('[KartePanel] loadKarte failed', e);
      setKarte(ensureKarteExists(storeId, {}));
    }
  }, [storeId, store]);

  useEffect(() => {
    loadKarte();
  }, [storeId, store, loadKarte]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = `${import.meta.env.BASE_URL}data/service_items.json`;
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(arr => {
        if (!cancelled) setServiceItems(Array.isArray(arr) && arr.length > 0 ? arr : FALLBACK_SERVICE_ITEMS);
      })
      .catch(() => {
        if (!cancelled) setServiceItems(FALLBACK_SERVICE_ITEMS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 自動保存: karteが変更されたら1.5秒後に自動保存（デバウンス）
  useEffect(() => {
    if (!storeId || isLocked) return;
    
    // 初回ロード時は保存しない
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastSavedKarteRef.current = JSON.stringify(karte);
      return;
    }

    // 前回保存した内容と同じ場合は保存しない
    const currentKarteStr = JSON.stringify(karte);
    if (currentKarteStr === lastSavedKarteRef.current) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await saveKarte(storeId, karte);
        lastSavedKarteRef.current = JSON.stringify(karte);
        console.log('[KartePanel] Auto-saved karte for store:', storeId);
      } catch (e) {
        console.warn('[KartePanel] Auto-save failed:', e);
      }
    }, 1500); // 1.5秒後に自動保存

    return () => {
      clearTimeout(timeoutId);
    };
  }, [karte, storeId, isLocked]);

  const update = (key, value) => setKarte(prev => ({ ...prev, [key]: value }));
  const updateArray = (key, updater) => setKarte(prev => ({ ...prev, [key]: updater(prev[key] || []) }));

  const toggleService = (title) => {
    updateArray('services', list => list.includes(title) ? list.filter(s => s !== title) : [...list, title]);
  };
  const toggleEquipment = (name) => {
    updateArray('equipment', list => list.includes(name) ? list.filter(e => e !== name) : [...list, name]);
  };

  const addConsumable = () => {
    if (!consumableName.trim()) return;
    updateArray('consumables', list => [...list, { name: consumableName.trim(), quantity: consumableQuantity.trim(), notes: '' }]);
    setConsumableName('');
    setConsumableQuantity('');
  };
  const removeConsumable = (index) => updateArray('consumables', list => list.filter((_, i) => i !== index));

  const addStaffHistory = () => {
    if (!staffName.trim()) return;
    updateArray('cleaning_staff_history', list => [...list, { worker_name: staffName.trim(), start_date: staffStartDate || null, end_date: null }]);
    setStaffName('');
    setStaffStartDate('');
  };
  const removeStaffHistory = (index) => updateArray('cleaning_staff_history', list => list.filter((_, i) => i !== index));

  const save = useCallback(async () => {
    if (!storeId || isLocked) return;
    setSaving(true);
    try {
      await saveKarte(storeId, karte);
      lastSavedKarteRef.current = JSON.stringify(karte);
    } catch (e) {
      console.error('[KartePanel] Save failed:', e);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [storeId, karte, isLocked]);

  useImperativeHandle(ref, () => ({ save }), [save]);

  const servicesByCategory = serviceItems.reduce((acc, s) => {
    const cat = s.category || 'その他';
    if (!acc[cat]) acc[cat] = []; acc[cat].push(s); return acc;
  }, {});

  const field = (label, value, placeholder = '') => (
    <div key={label} className="office-karte-panel-field">
      <label>{label}</label>
      <span className="office-karte-panel-value">{value || '-'}</span>
    </div>
  );
  const input = (label, key, placeholder, type = 'text') => (
    <div key={key} className="office-karte-panel-field">
      <label>{label}</label>
      <input
        type={type}
        value={karte[key] ?? ''}
        onChange={e => update(key, e.target.value)}
        placeholder={placeholder}
        disabled={isLocked}
        className="office-karte-panel-input"
      />
    </div>
  );
  const textarea = (label, key, placeholder) => (
    <div key={key} className="office-karte-panel-field">
      <label>{label}</label>
      <textarea
        value={karte[key] ?? ''}
        onChange={e => update(key, e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={isLocked}
        className="office-karte-panel-input"
      />
    </div>
  );
  const select = (label, key, options) => (
    <div key={key} className="office-karte-panel-field">
      <label>{label}</label>
      <select value={karte[key] ?? ''} onChange={e => update(key, e.target.value)} disabled={isLocked} className="office-karte-panel-input">
        <option value="">選択してください</option>
        {options.map(o => (
          <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="office-client-karte-panel" style={{ opacity: isLocked ? 0.6 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
      <div className="office-karte-panel-body">
        {/* 基本情報（表示のみ） */}
        <section className="office-karte-panel-section">
          <h3 className="office-karte-panel-section-title">基本情報</h3>
          <div className="office-karte-panel-grid">
            {field('ブランド名', brandName)}
            {field('店舗名', safeStore.name)}
            {field('担当者', safeStore.contact_person || safeStore.contact_name)}
            {field('住所', address)}
            {field('電話', safeStore.phone || safeStore.tel)}
            {field('メール', safeStore.email || safeStore.email_address)}
          </div>
          <div className="office-karte-panel-grid">
            {select('プラン', 'plan_frequency', PLAN_FREQUENCY_OPTIONS)}
            {input('セキュリティボックス No.', 'security_box_number', '例：1')}
          </div>
        </section>

        {/* 初回ヒアリング */}
        <section className="office-karte-panel-section">
          <h3 className="office-karte-panel-section-title">初回ヒアリング（営業問診票）</h3>
          <h4 className="office-karte-panel-subtitle">基本ヒアリング</h4>
          <div className="office-karte-panel-grid">
            {textarea('清掃の悩み', 'issue', '例：厨房の油汚れが落ちない')}
            {textarea('店内環境', 'environment', '例：油煙が強い、湿気が多い')}
            {input('稼働人数（最小）', 'staff_min', '選択してください')}
            {input('稼働人数（最大）', 'staff_max', '選択してください')}
            {input('稼働時間', 'hours', '例：11:00〜23:30')}
            {input('通常清掃の頻度', 'cleaning_frequency', '例：毎日（閉店後30分）')}
          </div>
          <h4 className="office-karte-panel-subtitle">店舗仕様</h4>
          <div className="office-karte-panel-grid">
            {input('平米数', 'area_sqm', '例：120')}
            {input('畳数', 'area_tatami', '例：72')}
            {input('天井高さ', 'ceiling_height', '例：2.6 m')}
            {input('アンペア数', 'electrical_amps', '例：60 A')}
            {input('トイレ数', 'toilet_count', '例：2 基')}
            {input('空調の数', 'aircon_count', '例：3台')}
            {input('壁の材質', 'wall_material', '例：タイル')}
            {input('床の材質', 'floor_material', '例：塩ビ')}
            {input('ブレーカーの位置', 'breaker_location', '例：厨房奥')}
            {input('鍵の位置', 'key_location', '例：受付右棚')}
            {input('出入口', 'entrances', '例：正面1/裏口1')}
            {select('スタッフルーム', 'staff_room', STAFF_ROOM_OPTIONS.map(v => ({ value: v, label: v })))}
            {input('ブレーカー位置の写真 URL', 'breaker_photo_url', '')}
            {input('鍵の置き場の写真 URL', 'key_photo_url', '')}
          </div>
          <h4 className="office-karte-panel-subtitle">設備・客席</h4>
          <div className="office-karte-panel-checkgroup">
            {['カウンター席', 'ボックス席', '座敷'].map(name => (
              <label key={name} className="office-karte-panel-check">
                <input type="checkbox" checked={name === 'カウンター席' ? karte.seat_counter : name === 'ボックス席' ? karte.seat_box : karte.seat_zashiki} onChange={e => update(name === 'カウンター席' ? 'seat_counter' : name === 'ボックス席' ? 'seat_box' : 'seat_zashiki', e.target.checked)} disabled={isLocked} />
                <span>{name}</span>
              </label>
            ))}
          </div>
          <h4 className="office-karte-panel-subtitle">設備情報（問診票）</h4>
          <div className="office-karte-panel-checkgroup">
            {EQUIPMENT_OPTIONS.map(name => (
              <label key={name} className="office-karte-panel-check">
                <input type="checkbox" checked={(karte.equipment || []).includes(name)} onChange={() => toggleEquipment(name)} disabled={isLocked} />
                <span>{name}</span>
              </label>
            ))}
          </div>
          <h4 className="office-karte-panel-subtitle">注意事項・計画</h4>
          <div className="office-karte-panel-grid">
            {input('空調設備の状態', 'aircon_state', '例：台数3、1台異音')}
            {input('厨房設備の状態', 'kitchen_state', '例：レンジフード油固着')}
            {input('特に気になる場所', 'hotspots', '例：ダクト、床排水溝')}
            {input('注意事項', 'intake_notes', '例：薬剤の臭いNG')}
            {input('最終清掃日', 'last_clean', '年/月/日', 'date')}
            {select('依頼プラン', 'plan', PLAN_SELECT_OPTIONS.map(v => ({ value: v, label: v })))}
            {select('衛生状態自己評価', 'self_rating', SELF_RATING_OPTIONS.map(v => ({ value: v, label: v })))}
          </div>
        </section>

        {/* サービス内容 */}
        <section className="office-karte-panel-section">
          <h3 className="office-karte-panel-section-title">サービス内容</h3>
          {loading ? (
            <p className="office-karte-panel-muted">読み込み中...</p>
          ) : (
            Object.entries(servicesByCategory).map(([category, items]) => (
              <div key={category} className="office-karte-panel-category">
                <h4 className="office-karte-panel-subtitle">{category}</h4>
                <div className="office-karte-panel-checkgroup">
                  {items.map(s => (
                    <label key={s.id || s.title} className="office-karte-panel-check">
                      <input type="checkbox" checked={(karte.services || []).includes(s.title)} onChange={() => toggleService(s.title)} disabled={isLocked} />
                      <span>{s.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {/* 使用消耗品 */}
        <section className="office-karte-panel-section">
          <h3 className="office-karte-panel-section-title">使用消耗品</h3>
          {(karte.consumables || []).length === 0 ? (
            <p className="office-karte-panel-muted">消耗品が登録されていません</p>
          ) : (
            <ul className="office-karte-panel-list">
              {karte.consumables.map((item, i) => (
                <li key={i} className="office-karte-panel-list-item">
                  <span>{item.name}{item.quantity ? `（${item.quantity}）` : ''}</span>
                  <button type="button" onClick={() => removeConsumable(i)} disabled={isLocked} className="office-karte-panel-list-remove" aria-label="削除">×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="office-karte-panel-inline">
            <input type="text" value={consumableName} onChange={e => setConsumableName(e.target.value)} disabled={isLocked} placeholder="品名" className="office-karte-panel-input office-karte-panel-input--small" />
            <input type="text" value={consumableQuantity} onChange={e => setConsumableQuantity(e.target.value)} disabled={isLocked} placeholder="数量" className="office-karte-panel-input office-karte-panel-input--small" />
            <button type="button" onClick={addConsumable} disabled={isLocked} className="office-karte-panel-btn office-karte-panel-btn--small">消耗品を追加</button>
          </div>
        </section>

        {/* 清掃担当者履歴 */}
        <section className="office-karte-panel-section">
          <h3 className="office-karte-panel-section-title">清掃担当者履歴</h3>
          {(karte.cleaning_staff_history || []).length === 0 ? (
            <p className="office-karte-panel-muted">担当者履歴がありません</p>
          ) : (
            <ul className="office-karte-panel-list">
              {karte.cleaning_staff_history.map((item, i) => (
                <li key={i} className="office-karte-panel-list-item">
                  <span>{item.worker_name || '-'} {item.start_date ? `（${item.start_date}〜）` : ''}</span>
                  <button type="button" onClick={() => removeStaffHistory(i)} disabled={isLocked} className="office-karte-panel-list-remove" aria-label="削除">×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="office-karte-panel-inline">
            <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} disabled={isLocked} placeholder="担当者名" className="office-karte-panel-input office-karte-panel-input--small" />
            <input type="date" value={staffStartDate} onChange={e => setStaffStartDate(e.target.value)} disabled={isLocked} className="office-karte-panel-input office-karte-panel-input--small" />
            <button type="button" onClick={addStaffHistory} disabled={isLocked} className="office-karte-panel-btn office-karte-panel-btn--small">担当者を追加</button>
          </div>
        </section>

        {/* メモ・特記事項 */}
        <section className="office-karte-panel-section">
          <h3 className="office-karte-panel-section-title">メモ・特記事項</h3>
          {textarea('特記事項や注意点', 'notes', '特記事項や注意点を入力してください')}
        </section>
      </div>
    </div>
  );
});

export default OfficeClientKartePanel;
