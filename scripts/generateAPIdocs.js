const path = require('path');
const execSync = require('child_process').execSync;

const entryPoints = {
  './packages/todo-mock-api/src/docs/openapi.yaml': 'todo_mock_api_doc.html',
};

function main() {
  for (const entryPoint in entryPoints) {
    const inPath = path.resolve(__dirname, '../', entryPoint);
    const outPath = path.resolve(__dirname, '../dist', entryPoints[entryPoint]);

    execSync(`npx redoc-cli build ${inPath} -o ${outPath}`);
    console.log(`generate API doc: ${inPath} -> ${outPath}`);
  }

  console.log('API docs generation finished');
}

main();
