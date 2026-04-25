const http = require('http');

const server = http.createServer((req, res) => {

  console.log("=== BACKEND REQUEST START ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", req.headers);

  let body = [];

  req.on('data', chunk => {
    body.push(chunk);
  });

  req.on('end', () => {
    body = Buffer.concat(body).toString();

    console.log("Body length:", body.length);
    console.log("Body content:", body);
    console.log("=== BACKEND REQUEST END ===");

    // ✅ IMPORTANT: send response back
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      note: "backend responded",
      body_length: body.length
    }));
  });
});

server.listen(3000, () => {
  console.log("Backend running on port 3000");
});
