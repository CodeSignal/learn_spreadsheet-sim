const express = require('express');
let currentRedirectUrl = null;

const app = express();

// API to update redirect URL
app.post('/setRedirect', express.json(), (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send('Missing URL');
    currentRedirectUrl = url;
    console.log(`🔁 Updated redirect URL to: ${url}`);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    if (!currentRedirectUrl) {
        return res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Waiting</title>
                <style>
                  body {
                    font-family: sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f4f4f4;
                    color: #555;
                  }
                </style>
                <script>
                  async function checkRedirect() {
                    try {
                      const res = await fetch('/redirect-check');
                      const data = await res.json();
                      if (data && data.url) {
                        window.location.href = data.url;
                      }
                    } catch (e) {
                      console.error('Polling failed', e);
                    }
                  }

                  setInterval(checkRedirect, 2000); // Check every 2 seconds
                </script>
              </head>
              <body>
                <h1>⏳ Preparing the spreadsheet...</h1>
              </body>
            </html>
        `);
    }
    res.redirect(302, currentRedirectUrl);
});

app.get('/redirect-check', (req, res) => {
    res.json({ url: currentRedirectUrl || null });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Proxy running on http://localhost:${PORT}`);
});
