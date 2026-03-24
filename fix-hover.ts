import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix hover states
content = content.replace(/hover:bg-stone-50 dark:bg-stone-900\/50/g, 'hover:bg-stone-50 dark:hover:bg-stone-900/50');
content = content.replace(/hover:bg-stone-100 dark:bg-stone-800/g, 'hover:bg-stone-100 dark:hover:bg-stone-800');
content = content.replace(/hover:bg-stone-200 dark:bg-stone-700/g, 'hover:bg-stone-200 dark:hover:bg-stone-700');
content = content.replace(/hover:border-stone-100 dark:border-stone-800/g, 'hover:border-stone-100 dark:hover:border-stone-800');
content = content.replace(/hover:border-stone-200 dark:border-stone-700/g, 'hover:border-stone-200 dark:hover:border-stone-700');
content = content.replace(/hover:border-stone-300 dark:border-stone-600/g, 'hover:border-stone-300 dark:hover:border-stone-600');
content = content.replace(/hover:text-stone-900 dark:text-stone-50/g, 'hover:text-stone-900 dark:hover:text-stone-50');
content = content.replace(/hover:text-stone-800 dark:text-stone-200/g, 'hover:text-stone-800 dark:hover:text-stone-200');
content = content.replace(/hover:text-stone-700 dark:text-stone-300/g, 'hover:text-stone-700 dark:hover:text-stone-300');
content = content.replace(/hover:text-stone-600 dark:text-stone-400/g, 'hover:text-stone-600 dark:hover:text-stone-400');
content = content.replace(/hover:text-stone-500 dark:text-stone-400/g, 'hover:text-stone-500 dark:hover:text-stone-400');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed hover states in App.tsx');
