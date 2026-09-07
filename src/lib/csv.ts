import { saveAs } from 'file-saver';

export function downloadCSV(filename: string, data: any[], columns?: { key: string; label: string }[]) {
  if (!data || !data.length) return;

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  
  const header = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  
  const rows = data.map(row => {
    return cols.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = '';
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    }).join(',');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
}
