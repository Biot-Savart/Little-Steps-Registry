import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix emerald colors
content = content.replace(/bg-emerald-50\/30/g, 'bg-emerald-50/30 dark:bg-emerald-900/20');
content = content.replace(/bg-emerald-50\/50/g, 'bg-emerald-50/50 dark:bg-emerald-900/30');
content = content.replace(/bg-emerald-50 /g, 'bg-emerald-50 dark:bg-emerald-900/30 ');
content = content.replace(/bg-emerald-50"/g, 'bg-emerald-50 dark:bg-emerald-900/30"');
content = content.replace(/border-emerald-100\/50/g, 'border-emerald-100/50 dark:border-emerald-800/50');
content = content.replace(/border-emerald-100/g, 'border-emerald-100 dark:border-emerald-800');
content = content.replace(/text-emerald-700/g, 'text-emerald-700 dark:text-emerald-400');
content = content.replace(/text-emerald-800/g, 'text-emerald-800 dark:text-emerald-300');
content = content.replace(/text-emerald-600/g, 'text-emerald-600 dark:text-emerald-400');
content = content.replace(/bg-emerald-500\/10/g, 'bg-emerald-500/10 dark:bg-emerald-500/20');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed emerald colors in App.tsx');
