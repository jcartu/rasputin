// PM2 Ecosystem Configuration for RASPUTIN + OpenManus
// Production deployment with automatic restarts

module.exports = {
  apps: [
    // RASPUTIN - Multi-model consensus engine
    {
      name: "rasputin",
      script: "dist/index.js",
      cwd: "/home/josh/rasputin",

      // Environment
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // Clustering - use 2 instances for redundancy on this beefy machine
      // Not more because the app uses WebSockets and needs sticky sessions
      instances: 1,
      exec_mode: "fork",

      // Auto-restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",

      // Restart policy
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: "10s",

      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/home/josh/rasputin/logs/error.log",
      out_file: "/home/josh/rasputin/logs/out.log",
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },

    // OpenManus - Manus-style autonomous agent
    {
      name: "openmanus",
      script: ".venv/bin/python",
      args: "-m uvicorn web.server:app --host 0.0.0.0 --port 8181",
      cwd: "/home/josh/rasputin/OpenManus",

      // Python interpreter from venv
      interpreter: "none",

      // Environment
      env: {
        PYTHONUNBUFFERED: "1",
      },

      // Single instance (agent sessions are stateful)
      instances: 1,
      exec_mode: "fork",

      // Auto-restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: "4G",

      // Restart policy
      restart_delay: 2000,
      max_restarts: 5,
      min_uptime: "10s",

      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/home/josh/rasputin/logs/openmanus-error.log",
      out_file: "/home/josh/rasputin/logs/openmanus-out.log",
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 10000,
    },
  ],
};
