// server.js

const http = require("http");
const fs = require("fs");

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end("Server error");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

const server = http.createServer(function (req, res) {
  if (req.url === "/") {
    serveFile(res, "./public/provider.html", "text/html");
    return;
  }

  if (req.url === "/styles.css") {
    serveFile(res, "./public/styles.css", "text/css");
    return;
  }

  if (req.url === "/script.js") {
    serveFile(res, "./public/script.js", "application/javascript");
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(3000, function () {
  console.log("Server running on http://localhost:3000");
});