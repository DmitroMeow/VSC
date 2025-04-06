const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let weatherData = { current: {} };
// Function to fetch weather data
async function fetchWeather() {
  try {
    const response = await fetch(
      "http://api.weatherapi.com/v1/current.json?key=c2fca2c38b884246bc2104149252303&q=Brovary&aqi=no",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching weather: ${response.statusText}`);
    }
    weatherData = await response.json(); // Parse the JSON response
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

// Fetch weather data every minute
fetchWeather(); // Initial fetch
setInterval(fetchWeather, 1000 * 60); // Fetch every 60 seconds

app.post("/weather", (req, res) => {
  res.send(weatherData.current);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "browser.html"));
});

// app.get('/signin', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'signin.html'));
// });

// app.get('/login', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'login.html'));
// });

app.get("/account", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "account.html"));
});

// app.post('/login', (req, res) => {
//     const { email, password } = req.body;
//     res.send("Proccessing");
// });

// app.post('/signin', (req, res) => {
//     const { email, username, password } = req.body;
//     res.send("Proccessing");
// });

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
