import http from "http";
import fs from "fs";

const server = http.createServer((req, res) => {
  let filePath = "./public/index.html";

  // Routing Logic
  if (req.url === "/provider") {
    filePath = "./public/provider.html";
  }
  if (req.url === "/client") {
    filePath = "./public/client.html";
  }

  // File Serving Logic
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end("Server error");
      return;
    }
    
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(content);
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});