const execSync = require('child_process').execSync;
const path = require('path');

const entryPoints = {
  './src/docs/openapi.yaml': 'index.html',
};

function main() {
  for (const entryPoint in entryPoints) {
    const inPath = path.resolve(__dirname, '../', entryPoint);
    const outPath = path.resolve(__dirname, '../docs', entryPoints[entryPoint]);

    execSync(`npx redoc-cli build ${inPath} -o ${outPath}`);
    console.log(`generate API doc: ${inPath} -> ${outPath}`);
  }

  console.log('API docs generation finished');
}

main();
