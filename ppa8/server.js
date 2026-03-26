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
  if (appt.recurrence !== undefined) {
    const validRecurrence = ["none", "daily", "weekly", "monthly"];
    if (typeof appt.recurrence !== "string" || !validRecurrence.includes(appt.recurrence)) {
      return "Invalid recurrence";
    }
  }
  if (appt.recurrenceCount !== undefined) {
    if (!Number.isInteger(appt.recurrenceCount) || appt.recurrenceCount < 1) {
      return "Invalid recurrenceCount";
    }
  }
  return null;
}

function parseDateTimeLocal(value) {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some(Number.isNaN)) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatDateTimeLocal(dateObj) {
  const pad = n => String(n).padStart(2, "0");
  return (
    String(dateObj.getFullYear())
    + "-" + pad(dateObj.getMonth() + 1)
    + "-" + pad(dateObj.getDate())
    + "T" + pad(dateObj.getHours())
    + ":" + pad(dateObj.getMinutes())
  );
}

function buildRecurringAppointments(baseAppointment) {
  const recurrence = baseAppointment.recurrence || "none";
  const recurrenceCount = baseAppointment.recurrenceCount || 1;

  if (recurrence === "none" || recurrenceCount === 1) {
    return [Object.assign({}, baseAppointment, { recurrence: "none", recurrenceCount: 1 })];
  }

  const start = parseDateTimeLocal(baseAppointment.startTime);
  const end = parseDateTimeLocal(baseAppointment.endTime);
  if (!start || !end) {
    return [];
  }

  const recurringAppointments = [];
  for (let i = 0; i < recurrenceCount; i += 1) {
    const startCopy = new Date(start.getTime());
    const endCopy = new Date(end.getTime());

    if (recurrence === "daily") {
      startCopy.setDate(startCopy.getDate() + i);
      endCopy.setDate(endCopy.getDate() + i);
    } else if (recurrence === "weekly") {
      startCopy.setDate(startCopy.getDate() + (i * 7));
      endCopy.setDate(endCopy.getDate() + (i * 7));
    } else if (recurrence === "monthly") {
      startCopy.setMonth(startCopy.getMonth() + i);
      endCopy.setMonth(endCopy.getMonth() + i);
    }

    recurringAppointments.push(Object.assign({}, baseAppointment, {
      startTime: formatDateTimeLocal(startCopy),
      endTime: formatDateTimeLocal(endCopy),
      recurrence,
      recurrenceCount,
    }));
  }

  return recurringAppointments;
}

// Returns true if appt overlaps an existing busy or out-of-office appointment.
// excludeId skips the appointment being replaced so it doesn't conflict with itself.
const checkOverlap = (appt, excludeId = null) => {
  return appointments.some(existing => {
    if (existing.id === excludeId) return false;
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

  const appointmentsToApply = buildRecurringAppointments(updatedAppointment);
  if (!appointmentsToApply.length) {
    return { error: "Invalid startTime/endTime for recurrence", status: 400 };
  }

  // Check for overlaps, excluding the appointment being replaced
  for (let i = 0; i < appointmentsToApply.length; i += 1) {
    if (checkOverlap(appointmentsToApply[i], id)) {
      return { error: "Appointment overlaps with an existing busy appointment", status: 409 };
    }
  }

  // Replace the existing object, preserving the id
  const primaryAppointment = appointmentsToApply[0];
  primaryAppointment.id = id;
  appointments[index] = primaryAppointment;

  // For recurring edits, add additional occurrences as separate appointments
  for (let i = 1; i < appointmentsToApply.length; i += 1) {
    const extraAppointment = appointmentsToApply[i];
    extraAppointment.id = String(Date.now()) + "-u" + String(i);
    appointments.push(extraAppointment);
  }

  // Save updated data to appointments.json
  saveAppointments();
  return { data: primaryAppointment, status: 200 };
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

      const appointmentsToCreate = buildRecurringAppointments(newAppointment);
      if (!appointmentsToCreate.length) {
        sendText(response, 400, "Invalid startTime/endTime for recurrence");
        return;
      }

      for (let i = 0; i < appointmentsToCreate.length; i += 1) {
        if (checkOverlap(appointmentsToCreate[i])) {
          sendText(response, 409, "One or more recurring appointments overlap with an existing appointment");
          return;
        }
      }

      const createdAppointments = [];
      for (let i = 0; i < appointmentsToCreate.length; i += 1) {
        const appointment = appointmentsToCreate[i];
        appointment.id = String(Date.now()) + "-" + String(i);
        appointments.push(appointment);
        createdAppointments.push(appointment);
      }

      saveAppointments();
      sendJson(response, 201, createdAppointments);
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
