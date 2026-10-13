import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
test('GitHub Pages workflow and Vercel config ship with the game',()=>{
 assert.ok(existsSync('.github/workflows/deploy.yml'));
 const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
 assert.match(workflow,/actions\/deploy-pages@v4/);
 assert.match(workflow,/npm run build/);
 const vercel=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.equal(vercel.outputDirectory,'dist');
 assert.match(readFileSync('vite.config.js','utf8'),/base:\s*['"]\.\/['"]/);
});

test("Vite launcher works even without Unix executable permission",()=>{
 const packageJson=JSON.parse(readFileSync("package.json","utf8"));
 assert.equal(packageJson.scripts.build,"node ./node_modules/vite/bin/vite.js build");
 assert.match(packageJson.scripts.dev,/^node \.\/node_modules\/vite\/bin\/vite\.js/);
});
