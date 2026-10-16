
export type Category = { id: string; name: string; color: string; icon: string };
export type Transaction = { id: string; categoryId: string; date: string; time: string; amount: number; remarks: string; createdAt: number };
export type DeletionRecord = { transactionId: string; reason: string; deletedAt: number };
export type Data = { version: 1; categories: Category[]; transactions: Transaction[]; budgets: Record<string, Record<string, number>>; heatThresholds: number[]; budgetThresholds: [number, number]; deletionLog?: DeletionRecord[] };
export function deleteTransaction(data: Data, transactionId: string, reason: string): Data {
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > 1000) throw new Error('Enter a deletion reason between 1 and 1,000 characters.');
  if (!data.transactions.some(t => t.id === transactionId)) throw new Error('This transaction could not be found. Reload and try again.');
  return { ...data, transactions: data.transactions.filter(t => t.id !== transactionId), deletionLog: [...(data.deletionLog || []), { transactionId, reason: trimmed, deletedAt: Date.now() }] };
}
export const palette = ['#008bc7','#7c65d1','#f29b38','#e2689a','#2ba68a','#547bd9','#bc7d40','#7c8c9f'];
export function initialData(): Data { return { version: 1, categories: ['Food','Groceries','Travel','Shopping','Bills','Health','Entertainment','Other'].map((name,i)=>({id: `category-${i}`, name, color: palette[i], icon: ['food','groceries','travel','shopping','bills','health','entertainment','other'][i]})), transactions: [], budgets: {}, heatThresholds: [20000,50000,100000], budgetThresholds: [80,100] }; }
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const money = (paise: number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:paise%100===0?0:2,maximumFractionDigits:2}).format(paise/100);
export function parseAmount(value: string): number | null { if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null; const [whole, fraction=''] = value.trim().split('.'); const p = Number(whole)*100+Number(fraction.padEnd(2,'0')); return Number.isSafeInteger(p) && p <= 100000000000 ? p : null; }
export const amountInput = (p: number) => (p/100).toFixed(2);
export const monthLabel = (m: string) => new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
export const dateLabel = (d: string) => new Date(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10))).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
export const previousMonth = (m: string) => { const d = new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
export const monthTransactions = (data: Data, month: string) => data.transactions.filter(t=>t.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)||b.createdAt-a.createdAt);
export const total = (transactions: Transaction[]) => transactions.reduce((sum,t)=>sum+t.amount,0);
export function categoryTotals(transactions: Transaction[]) { const result: Record<string,number>={}; for(const t of transactions) result[t.categoryId]=(result[t.categoryId]||0)+t.amount; return result; }
export function budgetStatus(spent: number, budget: number, thresholds: [number,number]) { if (!budget) return {text:'No budget set',tone:'neutral',percent:null}; const percent=spent/budget*100; return {text:percent>=thresholds[1]?'Limit reached':percent>=thresholds[0]?'Watch spending':'On track',tone:percent>=thresholds[1]?'red':percent>=thresholds[0]?'amber':'green',percent}; }
export const heatLevel = (amount: number, thresholds: number[]) => amount===0 ? 0 : 1+thresholds.filter(n=>amount>=n).length;
export function validDate(value: string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [y,m,d]=value.split('-').map(Number); const date=new Date(y,m-1,d); return y>=1900 && y<=9999 && date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d; }
