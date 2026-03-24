import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace colors
content = content.replace(/\bbg-white\b/g, 'bg-white dark:bg-stone-900');
content = content.replace(/\btext-stone-900\b/g, 'text-stone-900 dark:text-stone-50');
content = content.replace(/\btext-stone-800\b/g, 'text-stone-800 dark:text-stone-200');
content = content.replace(/\btext-stone-700\b/g, 'text-stone-700 dark:text-stone-300');
content = content.replace(/\btext-stone-600\b/g, 'text-stone-600 dark:text-stone-400');
content = content.replace(/\btext-stone-500\b/g, 'text-stone-500 dark:text-stone-400');
content = content.replace(/\btext-stone-400\b/g, 'text-stone-400 dark:text-stone-500');
content = content.replace(/\btext-stone-300\b/g, 'text-stone-300 dark:text-stone-600');
content = content.replace(/\btext-stone-200\b/g, 'text-stone-200 dark:text-stone-700');
content = content.replace(/\bbg-stone-50\b/g, 'bg-stone-50 dark:bg-stone-900/50');
content = content.replace(/\bbg-stone-100\b/g, 'bg-stone-100 dark:bg-stone-800');
content = content.replace(/\bbg-stone-200\b/g, 'bg-stone-200 dark:bg-stone-700');
content = content.replace(/\bbg-stone-800\b/g, 'bg-stone-800 dark:bg-stone-100');
content = content.replace(/\bbg-stone-900\b/g, 'bg-stone-900 dark:bg-stone-50');
content = content.replace(/\bborder-stone-100\b/g, 'border-stone-100 dark:border-stone-800');
content = content.replace(/\bborder-stone-200\b/g, 'border-stone-200 dark:border-stone-700');
content = content.replace(/\bborder-stone-300\b/g, 'border-stone-300 dark:border-stone-600');

// Fix text-white on dark buttons
content = content.replace(/bg-stone-800 text-white hover:bg-stone-900/g, 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-900 dark:hover:bg-stone-200');
content = content.replace(/bg-stone-900 hover:bg-stone-800 text-white/g, 'bg-stone-900 dark:bg-stone-50 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900');
content = content.replace(/bg-stone-900 text-white/g, 'bg-stone-900 dark:bg-stone-50 text-white dark:text-stone-900');

// Fix body background
content = content.replace(/className="min-h-screen bg-stone-50/g, 'className="min-h-screen bg-stone-50 dark:bg-stone-950');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced colors in App.tsx');
