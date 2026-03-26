// public/provider.js
// Provider calendar UI for PPA7
// Full CRUD: GET, POST, PUT, PATCH, DELETE

"use strict";

let currentMonth = 3; // 1 to 12
let currentYear = 2026;
let currentAppointmentId = null;
let allAppointments = [];

// Run once when the page loads
refreshCalendar();

// Show a user-facing message
function showMessage(text, kind) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = kind;
}

// GET all appointments then re-render the month grid and the appointment list
function refreshCalendar() {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/appointments");
  xhr.onload = function () {
    if (xhr.status === 200) {
      allAppointments = JSON.parse(xhr.responseText);
      renderCalendar(allAppointments);
      filterAppointments();
    } else {
      showMessage("GET failed: " + String(xhr.status), "error");
    }
  };
  xhr.send();
}

// Filter allAppointments by search text and status, then re-render the list
function filterAppointments() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const statusFilter = document.getElementById("filterStatus").value;

  const filtered = allAppointments.filter(appt => {
    const matchesText = !query
      || (appt.title || "").toLowerCase().includes(query)
      || (appt.description || "").toLowerCase().includes(query);
    const matchesStatus = !statusFilter || appt.status === statusFilter;
    return matchesText && matchesStatus;
  });

  renderAppointments(filtered);
}

function normalizeRecurrence(appt) {
  const recurrence = appt.recurrence || "none";
  const recurrenceCount = Number.isInteger(appt.recurrenceCount) && appt.recurrenceCount > 0
    ? appt.recurrenceCount
    : 1;
  return { recurrence, recurrenceCount };
}

// Render the month grid, inserting appointment items into each day cell
function renderCalendar(appointments) {
  setMonthTitle(currentMonth, currentYear);

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth - 1, 1);
  const startWeekday = firstDay.getDay(); // 0 Sunday to 6 Saturday
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Get today's date for highlighting
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  for (let i = 0; i < 42; i += 1) {
    const dayNumber = i - startWeekday + 1;
    const cell = document.createElement("div");
    cell.className = "dayCell";

    if (dayNumber >= 1 && dayNumber <= daysInMonth) {
      if (dayNumber === todayDay && currentMonth === todayMonth && currentYear === todayYear) {
        cell.classList.add("today");
      }

      const label = document.createElement("div");
      label.className = "dayNumber";
      label.textContent = String(dayNumber);
      cell.appendChild(label);

      // Insert all appointments that fall on this day and month
      for (let j = 0; j < appointments.length; j += 1) {
        const appt = appointments[j];
        const datePart = appt.startTime.split("T")[0];
        const apptYear = Number(datePart.split("-")[0]);
        const apptMonth = Number(datePart.split("-")[1]);
        const apptDay = Number(datePart.split("-")[2]);

        if (apptDay === dayNumber && apptMonth === currentMonth && apptYear === currentYear) {
          const item = document.createElement("div");
          item.className = "slotAvail status-" + (appt.status || "busy");

          const startClock = appt.startTime.split("T")[1];
          const recurrenceMeta = normalizeRecurrence(appt);
          let recurrenceSuffix = "";
          if (recurrenceMeta.recurrence !== "none") {
            recurrenceSuffix = " (" + recurrenceMeta.recurrence + ")";
          }
          item.textContent = (appt.title || "Untitled") + " " + startClock + recurrenceSuffix;

          // Clicking a calendar item opens the edit modal
          item.addEventListener("click", function () {
            openAppointmentModal(appt);
          });

          cell.appendChild(item);
        }
      }
    } else {
      cell.className += " empty";
    }

    grid.appendChild(cell);
  }
}

// Render the full appointments array as cards with an Edit button
function renderAppointments(appointmentsArray) {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  for (let i = 0; i < appointmentsArray.length; i++) {
    const appt = appointmentsArray[i];

    const card = document.createElement("div");
    card.className = "appointmentCard status-" + (appt.status || "busy");

    const info = document.createElement("div");
    const startFormatted = appt.startTime.replace("T", " ");
    const endFormatted = appt.endTime.replace("T", " ");
    const recurrenceMeta = normalizeRecurrence(appt);
    info.innerHTML = "<strong>" + (appt.title || "Untitled") + "</strong> &mdash; "
      + startFormatted + " to " + endFormatted;
    if (appt.description) {
      info.innerHTML += "<br><em>" + appt.description + "</em>";
    }
    if (recurrenceMeta.recurrence !== "none") {
      info.innerHTML += "<br>Repeats: " + recurrenceMeta.recurrence
        + " (" + String(recurrenceMeta.recurrenceCount) + " occurrences)";
    }
    card.appendChild(info);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openAppointmentModal(appt);
    });
    card.appendChild(editBtn);

    calendar.appendChild(card);
  }
}

// Display the modal and populate its form fields with the given appointment's data
function openAppointmentModal(appointment) {
  currentAppointmentId = appointment.id;

  document.getElementById("modalTitle").value = appointment.title || "";
  document.getElementById("modalDescription").value = appointment.description || "";
  document.getElementById("modalStartTime").value = appointment.startTime || "";
  document.getElementById("modalEndTime").value = appointment.endTime || "";
  document.getElementById("modalStatus").value = appointment.status || "busy";
  document.getElementById("modalAttendees").value = (appointment.attendees || []).join(", ");
  const recurrenceMeta = normalizeRecurrence(appointment);
  document.getElementById("modalRecurrence").value = recurrenceMeta.recurrence;
  document.getElementById("modalRecurrenceCount").value = String(recurrenceMeta.recurrenceCount);

  // display modal dialog
  document.getElementById("modalOverlay").style.display = "flex";
}

// Read modal form inputs and send a PUT request to replace the appointment
function saveAppointmentChanges() {
  // Read form inputs
  const title = document.getElementById("modalTitle").value.trim();
  const description = document.getElementById("modalDescription").value.trim();
  const startTime = document.getElementById("modalStartTime").value;
  const endTime = document.getElementById("modalEndTime").value;
  const status = document.getElementById("modalStatus").value;
  const attendeesRaw = document.getElementById("modalAttendees").value;
  const recurrence = document.getElementById("modalRecurrence").value;
  const recurrenceCountRaw = Number(document.getElementById("modalRecurrenceCount").value);
  const recurrenceCount = recurrence === "none" ? 1 : recurrenceCountRaw;
  const attendees = attendeesRaw
    ? attendeesRaw.split(",").map(a => a.trim()).filter(a => a)
    : [];

  if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1) {
    showMessage("Occurrences must be a whole number of at least 1", "error");
    return;
  }

  // Construct updated appointment object
  const updatedAppointment = {
    title,
    description,
    startTime,
    endTime,
    status,
    attendees,
    recurrence,
    recurrenceCount,
  };

  // Send PUT request to server
  const xhr = new XMLHttpRequest();
  xhr.open("PUT", "/appointments/" + currentAppointmentId);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Appointment updated", "ok");
      closeModal();
      refreshCalendar();
    } else {
      showMessage("Update failed: " + xhr.responseText, "error");
    }
  };
  xhr.send(JSON.stringify(updatedAppointment));
}

// Send PATCH with only the status field — partial update without replacing the whole object
function patchAppointmentStatus() {
  const status = document.getElementById("modalStatus").value;
  const xhr = new XMLHttpRequest();
  xhr.open("PATCH", "/appointments/" + currentAppointmentId);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Status updated", "ok");
      closeModal();
      refreshCalendar();
    } else {
      showMessage("Patch failed: " + xhr.responseText, "error");
    }
  };
  xhr.send(JSON.stringify({ status }));
}

// Arrow function: send DELETE for the currently open appointment, then refresh
const deleteButtonHandler = () => {
  // Send DELETE request
  const xhr = new XMLHttpRequest();
  xhr.open("DELETE", "/appointments/" + currentAppointmentId);
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Appointment deleted", "ok");
      closeModal();
      // Refresh calendar after deletion
      refreshCalendar();
    } else {
      showMessage("Delete failed: " + xhr.responseText, "error");
    }
  };
  xhr.send();
};

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
  currentAppointmentId = null;
}

// Update the month title header
function setMonthTitle(month, year) {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  document.getElementById("monthTitle").textContent =
    names[month - 1] + " " + String(year);
}

// Send POST then refresh everything on success
function sendCreateAppointment(title, description, startTime, endTime, status, attendees, recurrence, recurrenceCount) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/appointments");
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 201) {
      showMessage("Appointment added", "ok");
      refreshCalendar();
    } else {
      showMessage("Create failed: " + xhr.responseText, "error");
    }
  };
  xhr.send(JSON.stringify({
    title,
    description,
    startTime,
    endTime,
    status,
    attendees,
    recurrence,
    recurrenceCount,
  }));
}

// Button click: validate inputs then create an appointment
document.getElementById("createAppmtButton").addEventListener("click", function () {
  const title = document.getElementById("titleInput").value.trim();
  const description = document.getElementById("descriptionInput").value.trim();
  const startTime = document.getElementById("startTimeInput").value;
  const endTime = document.getElementById("endTimeInput").value;
  const status = document.getElementById("statusInput").value;
  const attendeesRaw = document.getElementById("attendeesInput").value;
  const recurrence = document.getElementById("recurrenceInput").value;
  const recurrenceCountRaw = Number(document.getElementById("recurrenceCountInput").value);
  const recurrenceCount = recurrence === "none" ? 1 : recurrenceCountRaw;
  const attendees = attendeesRaw
    ? attendeesRaw.split(",").map(a => a.trim()).filter(a => a)
    : [];

  if (!title) {
    showMessage("Please enter a title", "error");
    return;
  }
  if (!startTime) {
    showMessage("Please enter a start time", "error");
    return;
  }
  if (!endTime) {
    showMessage("Please enter an end time", "error");
    return;
  }
  if (endTime <= startTime) {
    showMessage("End time must be after start time", "error");
    return;
  }
  if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1) {
    showMessage("Occurrences must be a whole number of at least 1", "error");
    return;
  }

  sendCreateAppointment(
    title,
    description,
    startTime,
    endTime,
    status,
    attendees,
    recurrence,
    recurrenceCount
  );
});

// Month navigation
document.getElementById("prevMonthBtn").addEventListener("click", function () {
  currentMonth -= 1;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear -= 1;
  }
  refreshCalendar();
});

document.getElementById("nextMonthBtn").addEventListener("click", function () {
  currentMonth += 1;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear += 1;
  }
  refreshCalendar();
});

// Filter event handlers
document.getElementById("searchInput").addEventListener("input", filterAppointments);
document.getElementById("filterStatus").addEventListener("change", filterAppointments);

// Modal button handlers
document.getElementById("modalSaveBtn").addEventListener("click", saveAppointmentChanges);
document.getElementById("modalPatchStatusBtn").addEventListener("click", patchAppointmentStatus);
document.getElementById("modalDeleteBtn").addEventListener("click", deleteButtonHandler);
document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
