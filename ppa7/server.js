"use strict";

const http = require("http");
const url = require("url");
const fs = require("fs");

const DATA_FILE = "appointments.json";
let appointments = [];

// If the file does not exist or the JSON is invalid, start with an empty array.
// Errors are logged to the console so the developer knows something went wrong.
function loadAppointments() {
  try {
    const text = fs.readFileSync(DATA_FILE, "utf8");
    appointments = JSON.parse(text);
    if (!Array.isArray(appointments)) {
      appointments = [];
    }
  } catch (error) {
    console.log("Could not load appointments.json, starting with empty array.");
    appointments = [];
  }
}

// Pretty-print JSON (2-space indent) so the file is human-readable.
// If writing fails, log the error but do not crash the server.
function saveAppointments() {
  try {
    const text = JSON.stringify(appointments, null, 2);
    fs.writeFileSync(DATA_FILE, text, "utf8");
  } catch (error) {
    console.log("Failed to save appointments.json: " + error.message);
  }
}

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

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain" });
  response.end(message);
}

// Returns an error string if invalid, or null if valid.
function validateAppointment(appt) {
  if (typeof appt.title !== "string" || appt.title.trim() === "") {
    return "Missing or invalid title";
  }
  if (typeof appt.startTime !== "string" || appt.startTime === "") {
    return "Missing or invalid startTime";
  }
  if (typeof appt.endTime !== "string" || appt.endTime === "") {
    return "Missing or invalid endTime";
  }
  if (appt.endTime <= appt.startTime) {
    return "endTime must be after startTime";
  }
  return null;
}

// Returns true if appt overlaps an existing busy or out-of-office appointment.
// excludeId skips the appointment being replaced so it doesn't conflict with itself.
const checkOverlap = (appt, excludeId = null) => {
  const blockingStatuses = ["busy", "out-of-office"];
  const apptStatus = appt.status || "busy";
  if (!blockingStatuses.includes(apptStatus)) {
    return false;
  }
  return appointments.some(existing => {
    if (existing.id === excludeId) return false;
    const existingStatus = existing.status || "busy";
    if (!blockingStatuses.includes(existingStatus)) return false;
    return appt.startTime < existing.endTime && appt.endTime > existing.startTime;
  });
};

function updateAppointmentFull(id, updatedAppointment) {
  // Locate the appointment by id
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) {
    return { error: "Appointment not found", status: 404 };
  }

  // Validate the full appointment object
  const validationError = validateAppointment(updatedAppointment);
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  // Check for overlaps, excluding the appointment being replaced
  if (checkOverlap(updatedAppointment, id)) {
    return { error: "Appointment overlaps with an existing busy appointment", status: 409 };
  }

  // Replace the existing object, preserving the id
  updatedAppointment.id = id;
  appointments[index] = updatedAppointment;

  // Save updated data to appointments.json
  saveAppointments();
  return { data: updatedAppointment, status: 200 };
}

function updateAppointmentPartial(id, changes) {
  // Locate the appointment by id
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) {
    return { error: "Appointment not found", status: 404 };
  }

  // Merge only the provided fields with the existing appointment
  const merged = Object.assign({}, appointments[index], changes);
  merged.id = id;

  // Validate the resulting appointment
  const validationError = validateAppointment(merged);
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  // Check for overlaps after the merge, excluding this appointment
  if (checkOverlap(merged, id)) {
    return { error: "Appointment overlaps with an existing busy appointment", status: 409 };
  }

  // Save updated data to appointments.json
  appointments[index] = merged;
  saveAppointments();
  return { data: merged, status: 200 };
}

function deleteAppointment(id) {
  // Locate the appointment by id
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) {
    return { error: "Appointment not found", status: 404 };
  }

  // Remove the appointment from the array
  appointments.splice(index, 1);

  // Save updated data to appointments.json
  saveAppointments();
  return { status: 200 };
}

loadAppointments();

const server = http.createServer(function (request, response) {
  console.log("request url: ", request.url);
  const parsedUrl = url.parse(request.url, true);

  if (request.url === "/") {
    serveFile(response, "./public/appointment.html", "text/html");
    return;
  }

  if (request.url === "/styles.css") {
    serveFile(response, "./public/styles.css", "text/css");
    return;
  }

  if (request.url === "/provider.js") {
    serveFile(response, "./public/provider.js", "application/javascript");
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/appointments") {
    sendJson(response, 200, appointments);
  }

  else if (request.method === "POST" && parsedUrl.pathname === "/appointments") {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
    });
    request.on("end", function () {
      let newAppointment;
      try {
        newAppointment = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }

      const validationError = validateAppointment(newAppointment);
      if (validationError) {
        sendText(response, 400, validationError);
        return;
      }

      if (checkOverlap(newAppointment)) {
        sendText(response, 409, "Appointment overlaps with an existing busy appointment");
        return;
      }

      newAppointment.id = String(Date.now());
      appointments.push(newAppointment);
      saveAppointments();
      sendJson(response, 201, newAppointment);
    });
  }

  else if (request.method === "PUT" && parsedUrl.pathname.startsWith("/appointments/")) {
    const id = parsedUrl.pathname.split("/")[2];
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      let updatedAppointment;
      try {
        updatedAppointment = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }
      const result = updateAppointmentFull(id, updatedAppointment);
      if (result.error) {
        sendText(response, result.status, result.error);
      } else {
        sendJson(response, result.status, result.data);
      }
    });
  }

  else if (request.method === "PATCH" && parsedUrl.pathname.startsWith("/appointments/")) {
    const id = parsedUrl.pathname.split("/")[2];
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      let changes;
      try {
        changes = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }
      const result = updateAppointmentPartial(id, changes);
      if (result.error) {
        sendText(response, result.status, result.error);
      } else {
        sendJson(response, result.status, result.data);
      }
    });
  }

  else if (request.method === "DELETE" && parsedUrl.pathname.startsWith("/appointments/")) {
    const id = parsedUrl.pathname.split("/")[2];
    const result = deleteAppointment(id);
    if (result.error) {
      sendText(response, result.status, result.error);
    } else {
      sendText(response, 200, "Appointment deleted");
    }
  }

  else {
    sendText(response, 404, "Not found");
  }
});

server.listen(3000);
console.log("Server running at http://localhost:3000");
