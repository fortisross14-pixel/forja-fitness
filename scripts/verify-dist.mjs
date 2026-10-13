import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../dist/',import.meta.url).pathname;
if(!existsSync(join(root,'index.html')))throw new Error('Falta dist/index.html. Ejecuta npm run build.');
const html=readFileSync(join(root,'index.html'),'utf8');
const assets=existsSync(join(root,'assets'))?readdirSync(join(root,'assets')):[];
if(!assets.some(x=>x.endsWith('.js'))||!assets.some(x=>x.endsWith('.css')))throw new Error('Faltan assets de React/CSS en dist/assets');
if(!html.includes('assets/'))throw new Error('El HTML no referencia los assets generados.');
console.log('FORJA: dist/index.html, JS y CSS comprobados.');
