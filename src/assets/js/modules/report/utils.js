/**
 * Generate a unique ID (UUID v4-like)
 */
export function generateId(prefix = 'id') {
    return prefix + '_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str 
 */
export function escapeHtml(str) {
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
