const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const yaml = require('yaml');

// Try to load WebSocket module, fallback if not available
let WebSocket = null;
let isWebSocketAvailable = false;
try {
  WebSocket = require('ws');
  isWebSocketAvailable = true;
  console.log('WebSocket support enabled');
} catch (error) {
  console.log('WebSocket support disabled (ws package not installed)');
  console.log('Install with: npm install ws');
}

const PORT = process.env.PORT || 3000;

// Get config file path from command line args or environment variable
// Command line: node config-server.js --config=path/to/config.yaml
// Environment: CONFIG_FILE=path/to/config.yaml node config-server.js
let configFilePath = process.env.CONFIG_FILE;
if (!configFilePath) {
  // Check command line arguments
  const args = process.argv.slice(2);
  const configArg = args.find(arg => arg.startsWith('--config='));
  if (configArg) {
    configFilePath = configArg.split('=')[1];
  }
}

// Default to config-example.yaml if not specified
const CONFIG_FILE = configFilePath 
  ? (path.isAbsolute(configFilePath) ? configFilePath : path.join(__dirname, configFilePath))
  : path.join(__dirname, 'config-example.yaml');

// Track connected WebSocket clients
const wsClients = new Set();

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Get MIME type based on file extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'text/plain';
}

// Serve static files
function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const mimeType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

// Handle GET /api/config - read YAML config file
function handleGetConfig(req, res) {
  fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
    if (err) {
      // If file doesn't exist, create it with empty values
      if (err.code === 'ENOENT') {
        const defaultConfig = {
          spreadsheetURL: '',
          cellsToVerify: []
        };
        
        const yamlStr = yaml.stringify(defaultConfig, {
          indent: 2,
          lineWidth: 0,
          doubleQuotedAsJSON: false,
          quoteKeys: false
        });
        
        fs.writeFile(CONFIG_FILE, yamlStr, 'utf8', (writeErr) => {
          if (writeErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to create config file', details: writeErr.message }));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(defaultConfig));
        });
        return;
      }
      
      // Other errors
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read config file', details: err.message }));
      return;
    }

    try {
      const config = yaml.parse(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to parse YAML', details: error.message }));
    }
  });
}

// Handle POST /api/config - write YAML config file
function handlePostConfig(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const config = JSON.parse(body);
      const yamlStr = yaml.stringify(config, {
        indent: 2,
        lineWidth: 0,
        doubleQuotedAsJSON: false,
        quoteKeys: false
      });

      fs.writeFile(CONFIG_FILE, yamlStr, 'utf8', (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write config file', details: err.message }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON or YAML conversion failed', details: error.message }));
    }
  });
}

// Handle POST requests
function handlePostRequest(req, res, parsedUrl) {
  if (parsedUrl.pathname === '/api/config') {
    handlePostConfig(req, res);
  } else if (parsedUrl.pathname === '/message') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const message = data.message;

        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Message is required' }));
          return;
        }

        // Check if WebSocket is available
        if (!isWebSocketAvailable) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'WebSocket functionality not available',
            details: 'Install the ws package with: npm install ws'
          }));
          return;
        }

        // Broadcast message to all connected WebSocket clients
        wsClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'message', message: message }));
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clientCount: wsClients.size }));

      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Handle API endpoints
  if (parsedUrl.pathname === '/api/config') {
    if (req.method === 'GET') {
      handleGetConfig(req, res);
    } else if (req.method === 'POST') {
      handlePostConfig(req, res);
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }
    return;
  }
  
  // Handle POST requests
  if (req.method === 'POST') {
    handlePostRequest(req, res, parsedUrl);
    return;
  }

  // Serve files from client folder
  let pathName = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  const filePath = path.join(__dirname, 'client', pathName);
  
  serveFile(filePath, res);
});

// Create WebSocket server only if WebSocket is available
// Note: WebSocket upgrade handling is performed automatically by the ws library
// when attached to the HTTP server. The HTTP request handler should NOT send
// a response for upgrade requests - the ws library handles the upgrade internally.
if (isWebSocketAvailable) {
  const wss = new WebSocket.Server({
    server,
    path: '/ws'
  });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket client connected');
    wsClients.add(ws);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Config file: ${CONFIG_FILE}`);
  if (isWebSocketAvailable) {
    console.log(`WebSocket server running on /ws`);
  } else {
    console.log(`WebSocket functionality disabled - install 'ws' package to enable`);
  }
  console.log('Press Ctrl+C to stop the server');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
