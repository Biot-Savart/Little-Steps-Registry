import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix indigo colors
content = content.replace(/bg-indigo-50\/50/g, 'bg-indigo-50/50 dark:bg-indigo-900/30');
content = content.replace(/bg-indigo-50 /g, 'bg-indigo-50 dark:bg-indigo-900/30 ');
content = content.replace(/bg-indigo-50"/g, 'bg-indigo-50 dark:bg-indigo-900/30"');
content = content.replace(/hover:bg-indigo-50"/g, 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30"');
content = content.replace(/hover:bg-indigo-100/g, 'hover:bg-indigo-100 dark:hover:bg-indigo-800/50');
content = content.replace(/border-indigo-100/g, 'border-indigo-100 dark:border-indigo-800');
content = content.replace(/border-indigo-200/g, 'border-indigo-200 dark:border-indigo-700');
content = content.replace(/text-indigo-800/g, 'text-indigo-800 dark:text-indigo-300');
content = content.replace(/text-indigo-700/g, 'text-indigo-700 dark:text-indigo-400');
content = content.replace(/text-indigo-600/g, 'text-indigo-600 dark:text-indigo-400');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed indigo colors in App.tsx');
