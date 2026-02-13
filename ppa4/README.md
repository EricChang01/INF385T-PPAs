## Execution Flow
The if/else statements control which action to take depending on the type of request sent from the client. If the server receives a POST request, it attempts to add a new reservation; if the server receives a DELETE request, it attempts to delete an existing reservation that has an exact match.

## Location of Conditionals
Conidtionals occur in `server.js` and `script.js`. In `server.js`, it mostly handles the branching of different types of incoming requests, either a request for a file or an api call. Using the conditionals, the server either returns the requested document or perform action based on the information sent.

## Explain how document.getElementById connects user interface elements to program logic
It is used to get the data from the client and then pass it to the server. It is also used to clear the field in the client whenever a request succeed.

## GUI Improvements
In this version of booking system, it also supports deleting an existing reservation, which is common practice in a booking system. In addition, the reservations for different types of courts are separated. 