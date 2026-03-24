import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix amber colors
content = content.replace(/bg-amber-50 /g, 'bg-amber-50 dark:bg-amber-900/30 ');
content = content.replace(/bg-amber-50"/g, 'bg-amber-50 dark:bg-amber-900/30"');
content = content.replace(/border-amber-100/g, 'border-amber-100 dark:border-amber-800');
content = content.replace(/text-amber-600/g, 'text-amber-600 dark:text-amber-400');
content = content.replace(/text-amber-700/g, 'text-amber-700 dark:text-amber-300');
content = content.replace(/text-amber-800/g, 'text-amber-800 dark:text-amber-200');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed amber colors in App.tsx');
