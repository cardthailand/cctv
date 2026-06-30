module.exports = {
  apps: [
    {
      name: 'cctv-web-client',
      script: 'src/server.js',
      cwd: '/home/cctv/domains/cctvcard.in.th/public_html',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
