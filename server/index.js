// O servidor de verdade mora em src/. Este arquivo existe só pra que
// `node server/index.js` continue funcionando.
import { start } from './src/index.js';

start().then(({ url }) => console.log(`Nossa Sessão — backend em ${url}`)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
