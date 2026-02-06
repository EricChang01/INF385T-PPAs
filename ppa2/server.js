import http from "http";
import fs from "fs";

const slots = [
  {
    id: 1,
    startTime: "2026-03-01T09:00",
    endTime: "2026-03-01T09:30",
    status: "available"
  },
  {
    id: 2,
    startTime: "2026-03-01T10:00",
    endTime: "2026-03-01T10:30",
    status: "available"
  },
  {
    id: 3,
    startTime: "2026-03-01T11:00",
    endTime: "2026-03-01T11:30",
    status: "available"
  },
  {
    id: 4,
    startTime: "2026-03-01T14:00",
    endTime: "2026-03-01T14:30",
    status: "available"
  },
  {
    id: 5,
    startTime: "2026-03-01T15:00",
    endTime: "2026-03-01T15:30",
    status: "booked"
  }
];

const server = http.createServer((req, res) => {
  console.log("Request:", req.method, req.url);

  if (req.url === "/api/slots" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(slots));
    return;
  } 
  
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