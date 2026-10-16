import { initialData, validDate, type Data } from './domain';
export const STORAGE_KEY = 'bluebook.expenses.v1';
function validDeletionLog(log: unknown) {
  return log === undefined || (Array.isArray(log) && log.every(entry => entry && typeof entry.transactionId === 'string' && entry.transactionId.length > 0 && entry.transactionId.length <= 100 && typeof entry.reason === 'string' && entry.reason.trim().length > 0 && entry.reason.length <= 1000 && Number.isSafeInteger(entry.deletedAt) && entry.deletedAt >= 0));
}
export function loadData(): { data: Data; error?: string } {
  try {
    const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return {data:initialData()};
    const d=JSON.parse(raw);
    const amount=(n: unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100000000000;
    if(d.version!==1 || !Array.isArray(d.categories) || !d.categories.length || !d.categories.every((c: any)=>typeof c.id==='string'&&typeof c.name==='string'&&typeof c.color==='string'&&typeof c.icon==='string') || !Array.isArray(d.transactions) || !d.transactions.every((t: any)=>typeof t.id==='string'&&d.categories.some((c: any)=>c.id===t.categoryId)&&validDate(t.date)&&typeof t.time==='string'&&(!t.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))&&amount(t.amount)&&t.amount>0&&typeof t.remarks==='string'&&Number.isFinite(t.createdAt)) || !d.budgets || typeof d.budgets!=='object' || !Object.entries(d.budgets).every(([m,b])=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&b&&typeof b==='object'&&Object.values(b).every(amount)) || !Array.isArray(d.heatThresholds) || d.heatThresholds.length!==3 || !d.heatThresholds.every((n: number,i: number)=>amount(n)&&n>0&&(i===0||n>d.heatThresholds[i-1])) || !Array.isArray(d.budgetThresholds) || d.budgetThresholds.length!==2 || !(d.budgetThresholds[0]>0&&d.budgetThresholds[0]<d.budgetThresholds[1]&&d.budgetThresholds[1]<=100)) throw new Error('Invalid storage');
    if (!validDeletionLog(d.deletionLog)) throw new Error('Invalid deletion history');
    return {data:d};
  } catch { return {data:initialData(),error:'Your saved data could not be read. It has not been overwritten. Export the stored data below before replacing it.'}; }
}
export function saveData(data: Data) { localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); }
// Validate a JSON backup without touching the browser's saved records.
export function validateData(input: unknown): Data {
  const d = input as any;
  const amount = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 100000000000;
  if (!d || d.version !== 1 || !Array.isArray(d.categories) || !d.categories.length || !d.categories.every((c: any) => typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string' && typeof c.icon === 'string') || !Array.isArray(d.transactions) || !d.transactions.every((t: any) => typeof t.id === 'string' && d.categories.some((c: any) => c.id === t.categoryId) && validDate(t.date) && typeof t.time === 'string' && (!t.time || /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) && amount(t.amount) && t.amount > 0 && typeof t.remarks === 'string' && Number.isFinite(t.createdAt)) || !d.budgets || typeof d.budgets !== 'object' || !Object.entries(d.budgets).every(([m, b]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && b && typeof b === 'object' && Object.values(b).every(amount)) || !Array.isArray(d.heatThresholds) || d.heatThresholds.length !== 3 || !d.heatThresholds.every((n: number, i: number) => amount(n) && n > 0 && (i === 0 || n > d.heatThresholds[i - 1])) || !Array.isArray(d.budgetThresholds) || d.budgetThresholds.length !== 2 || !d.budgetThresholds.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)) || !(d.budgetThresholds[0] > 0 && d.budgetThresholds[0] < d.budgetThresholds[1] && d.budgetThresholds[1] <= 100) || new Set(d.categories.map((c: any) => c.id)).size !== d.categories.length || new Set(d.transactions.map((t: any) => t.id)).size !== d.transactions.length) throw new Error('Invalid expense backup. Choose a JSON file exported from Bluebook.');
  if (!validDeletionLog(d.deletionLog)) throw new Error('Invalid deletion history in expense backup.');
  return d;
}
