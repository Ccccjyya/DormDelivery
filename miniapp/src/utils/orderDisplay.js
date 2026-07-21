const labels = { WAITING: '待接取', DELIVERING: '配送中', COMPLETED: '已完成', EXPIRED: '已失效' };
export function getOrderStatusLabel(order) { return order?.withdrawn ? '已失效' : (labels[order?.status] || '未知状态'); }
export function formatDateTime(value) { if (!value) return ''; const date = value instanceof Date ? value : new Date(value.$date ?? value); if (Number.isNaN(date.getTime())) return ''; const p = (n) => String(n).padStart(2, '0'); return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`; }
