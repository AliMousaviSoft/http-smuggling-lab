const http = require('http');

const server = http.createServer((req, res) => {
  let body = [];

  req.on('data', chunk => {
    body.push(chunk);
  });

  req.on('end', () => {
    body = Buffer.concat(body).toString();

    console.log("=== BACKEND RECEIVED REQUEST ===");
    console.log(req.method, req.url);
    console.log("Headers:", req.headers);
    console.log("Body:", body);
    console.log("================================");

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: "Hello from backend",
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body
    }));
  });
});

server.listen(3000, () => {
  console.log("Backend running on port 3000");
});
