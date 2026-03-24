import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix cascading replacements
content = content.replace(/bg-white dark:bg-stone-900 dark:bg-stone-50/g, 'bg-white dark:bg-stone-900');
content = content.replace(/bg-stone-50 dark:bg-stone-900 dark:bg-stone-50\/50/g, 'bg-stone-50 dark:bg-stone-900/50');
content = content.replace(/bg-stone-100 dark:bg-stone-800 dark:bg-stone-100/g, 'bg-stone-100 dark:bg-stone-800');
content = content.replace(/text-stone-800 dark:text-stone-200 dark:text-stone-700/g, 'text-stone-800 dark:text-stone-200');
content = content.replace(/text-stone-700 dark:text-stone-300 dark:text-stone-600/g, 'text-stone-700 dark:text-stone-300');
content = content.replace(/text-stone-600 dark:text-stone-400 dark:text-stone-500/g, 'text-stone-600 dark:text-stone-400');
content = content.replace(/text-stone-500 dark:text-stone-400 dark:text-stone-500/g, 'text-stone-500 dark:text-stone-400');

// Fix body background
content = content.replace(/className="min-h-screen bg-stone-50 dark:bg-stone-950 dark:bg-stone-900 dark:bg-stone-50\/50/g, 'className="min-h-screen bg-stone-50 dark:bg-stone-950');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed cascading replacements in App.tsx');
