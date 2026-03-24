import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix rose colors
content = content.replace(/bg-rose-50 /g, 'bg-rose-50 dark:bg-rose-900/30 ');
content = content.replace(/bg-rose-50"/g, 'bg-rose-50 dark:bg-rose-900/30"');
content = content.replace(/border-rose-100/g, 'border-rose-100 dark:border-rose-800');
content = content.replace(/text-rose-600/g, 'text-rose-600 dark:text-rose-400');
content = content.replace(/bg-rose-500/g, 'bg-rose-500 dark:bg-rose-600');
content = content.replace(/border-white/g, 'border-white dark:border-stone-900');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed rose colors in App.tsx');
