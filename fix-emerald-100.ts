import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix emerald-100
content = content.replace(/bg-emerald-100/g, 'bg-emerald-100 dark:bg-emerald-900/50');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed emerald-100 in App.tsx');
