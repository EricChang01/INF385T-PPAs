// public/provider.js
// Provider calendar UI for PPA6
// GET, POST, and DELETE for appointments

"use strict";

let currentMonth = 2; // 1 to 12
let currentYear = 2026;

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
      const appointments = JSON.parse(xhr.responseText);
      renderCalendar(appointments);
      renderAppointments(appointments);
    } else {
      showMessage("GET failed: " + String(xhr.status), "error");
    }
  };
  xhr.send();
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
          item.className = "slotAvail";

          const startClock = appt.startTime.split("T")[1];
          const endClock = appt.endTime.split("T")[1];
          item.textContent = startClock + " to " + endClock;
          cell.appendChild(item);
        }
      }
    } else {
      cell.className += " empty";
    }

    grid.appendChild(cell);
  }
}

// Render the full appointments array as cards with delete buttons
function renderAppointments(appointmentsArray) {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  for (let i = 0; i < appointmentsArray.length; i++) {
    const appt = appointmentsArray[i];

    const card = document.createElement("div");
    card.className = "appointmentCard";

    // Show start and end datetime, replacing T with a space for readability
    const startFormatted = appt.startTime.replace("T", " ");
    const endFormatted = appt.endTime.replace("T", " ");
    card.innerText = startFormatted + " to " + endFormatted;

    const del = document.createElement("button");
    del.innerText = "Delete";
    del.onclick = function () {
      // DELETE /appointments/:index then refresh
      deleteAppointment(i);
    };

    card.appendChild(del);
    calendar.appendChild(card);
  }
}

// Send DELETE then refresh everything on success
function deleteAppointment(index) {
  const xhr = new XMLHttpRequest();
  xhr.open("DELETE", "/appointments/" + index);
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Appointment deleted", "ok");
      refreshCalendar();
    } else {
      showMessage("Delete failed: " + xhr.responseText, "error");
    }
  };
  xhr.send();
}

// Send POST then refresh everything on success
function sendCreateAppointment(startTime, endTime) {
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
  xhr.send(JSON.stringify({ startTime: startTime, endTime: endTime }));
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

// Button click: validate inputs then create an appointment
document.getElementById("createAppmtButton").addEventListener("click", function () {
  const startTime = document.getElementById("startTimeInput").value;
  const endTime = document.getElementById("endTimeInput").value;

  if (!startTime && !endTime) {
    showMessage("Please enter a start time and end time", "error");
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

  sendCreateAppointment(startTime, endTime);
});
