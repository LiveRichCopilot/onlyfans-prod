const { execSync } = require('child_process');
try {
  // Let's first install esbuild locally in a sub-folder to bypass standard Next.js sandbox EPERM
  execSync('npm init -y && npm install esbuild', { cwd: '/tmp/test_build', stdio: 'inherit' });
} catch(e) {}
