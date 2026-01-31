/**
 * job一覧・表示名・パーソナルカラー等
 * ビジュアライザー発光色・各モードのアクセントカラーとして共通利用。
 */
export const JOBS = {
  cleaning: {
    label: '清掃',
    color: '#10b981',
    colorVar: '--job-cleaning',
    glowVar: '--job-cleaning-glow',
    icon: 'fa-broom',
  },
  office: {
    label: '事務',
    color: '#3b82f6',
    colorVar: '--job-office',
    glowVar: '--job-office-glow',
    icon: 'fa-briefcase',
  },
  sales: {
    label: '営業',
    color: '#8b5cf6',
    colorVar: '--job-sales',
    glowVar: '--job-sales-glow',
    icon: 'fa-handshake',
  },
  hr: {
    label: '人事',
    color: '#ec4899',
    colorVar: '--job-hr',
    glowVar: '--job-hr-glow',
    icon: 'fa-users',
  },
  accounting: {
    label: '経理',
    color: '#eab308',
    colorVar: '--job-accounting',
    glowVar: '--job-accounting-glow',
    icon: 'fa-calculator',
  },
  admin: {
    label: '管理',
    color: '#ffffff',
    colorVar: '--job-admin',
    glowVar: '--job-admin-glow',
    icon: 'fa-cog',
  },
  dev: {
    label: '開発',
    color: '#ef4444',
    colorVar: '--job-dev',
    glowVar: '--job-dev-glow',
    icon: 'fa-code',
  },
};

export const JOB_KEYS = Object.keys(JOBS);
