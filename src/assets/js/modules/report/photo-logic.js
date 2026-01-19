
/**
 * Photo Requirement Logic
 */

export const PHOTO_REQUIREMENTS = new Map([
    ['床・共用部清掃', { min: 4, internal: false }],
    ['店舗内簡易清掃', { min: 4, internal: false }],
    ['窓・ガラス清掃', { min: 4, internal: false }],
    ['換気扇（外側のみ）', { min: 4, internal: false }],
    ['トイレ清掃', { min: 4, internal: false }],
    ['厨房床清掃', { min: 4, internal: false }],
    ['シンク清掃', { min: 4, internal: false }],
    ['排気ファン清掃', { min: 5, internal: false }],
    ['レンジフード清掃', { min: 6, internal: true }],
    ['ダクト清掃', { min: 6, internal: true }],
    ['グリストラップ清掃', { min: 6, internal: true }],
    ['配管高圧洗浄', { min: 5, internal: false }],
    ['防火シャッター清掃', { min: 5, internal: false }]
]);

export function resolveScheduleLines(schedule) {
    if (!schedule) return [];
    const items = schedule.cleaning_items || schedule.service_items || (schedule.service_names ? (Array.isArray(schedule.service_names) ? schedule.service_names : [schedule.service_names]) : []) || [];
    return items
        .map(item => (typeof item === 'object' ? (item.name || item.item_name || item.title || '') : item))
        .map(item => String(item || '').trim())
        .filter(Boolean);
}

export function computePhotoRequirement(lines) {
    const fallback = { min: 3, internal: false, isFallback: true };
    if (!lines || lines.length === 0) return fallback;

    let maxMin = 0;
    let internal = false;
    let matched = 0;

    lines.forEach(line => {
        // Strict internal check for Phase 1
        if (line.includes('レンジフード') || line.includes('ダクト') || line.includes('グリストラップ')) {
            internal = true;
        }

        const requirement = PHOTO_REQUIREMENTS.get(line);
        if (requirement) {
            maxMin = Math.max(maxMin, requirement.min);
            if (requirement.internal) internal = true;
            matched += 1;
        }
    });

    if (matched === 0) {
        return { min: 3, internal: internal, isFallback: true };
    }
    return { min: maxMin, internal: internal, isFallback: false };
}

export function shouldCountPhoto(photo) {
    if (!photo || typeof photo !== 'object') return false;
    if (photo.status === 'removed' || photo.removed === true) return false;
    return true;
}

export function countUploadedPhotos(state) {
    const activeTab = state.activeTab || 'new';
    const sections = state.sections?.[activeTab] || {};

    return Object.values(sections).reduce((total, section) => {
        // 1. Regular imageContents
        const imageContents = section.imageContents || [];
        const sectionCount = imageContents.reduce((sum, content) => {
            const photos = content.photos || {};
            return sum
                + (photos.before ? photos.before.filter(shouldCountPhoto).length : 0)
                + (photos.after ? photos.after.filter(shouldCountPhoto).length : 0)
                + (photos.completed ? photos.completed.filter(shouldCountPhoto).length : 0);
        }, 0);

        // 2. CustomContents images
        const customCount = (section.customContents || []).reduce((sum, content) => {
            if (content.type === 'image' && shouldCountPhoto(content.image)) {
                return sum + 1;
            }
            return sum;
        }, 0);

        return total + sectionCount + customCount;
    }, 0);
}
