# PPA8: Classes and Object-Oriented Calendar

### The `Appointment` Class

- Constructor with required and optional fields
  - Required: `title`, `startDateTime`, `endDateTime`
  - Optional/defaulted: `status`, `description`, `attendees`, `recurrence`, `recurrenceCount`, `id`
- `conflictsWith(other)`
  - Overlap logic is time-based (`start < other.end && end > other.start`)
- `update(data)`
  - Updates only provided fields
  - Reuses setter validation
  - Rolls back to prior state on invalid update
- `toDisplayString()`
  - Formats title/time/description for UI display
- `static createFromJSON(data)`
  - Converts plain JSON objects into class instances
  - Supports `startTime`/`endTime` payload shape
- Getter/Setter usage
  - `get duration()` returns minutes
  - `set title(value)` validates not empty and max length
  - Additional setters validate status, recurrence, attendees, and date consistency


### Inheritance vs Delegation Decision
- `Meeting` is implemented as a subclass: `class Meeting extends Appointment`.
- Rationale: a meeting is a specialized timed appointment and shares core time/validation/conflict behavior.
- `AllDayEvent` is not implemented and would likely be better handled via delegation/composition due to different time semantics.

### Server Integration
- JSON file is loaded and converted to class instances.
- Instances are converted back to JSON before persistence.
- CRUD endpoints remain functional:
  - `GET /appointments`
  - `POST /appointments`
  - `PUT /appointments/:id`
  - `PATCH /appointments/:id`
  - `DELETE /appointments/:id`

## Bonus Features Implemented
- `Meeting` subclass
- Attendees list
- Duration getter
- Status-based color coding

## Notes
- IDs are reassigned sequentially on startup and new IDs are monotonically increasing for created appointments.
