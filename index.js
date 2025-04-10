const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const jwttoken = "12345678";
// Database setup
const database = new sqlite3.Database("./users.db", (err) => {
  if (err) {
    console.error(err.message);
  }
});

database.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);
database.run(`
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL
)
`);

// User functions
async function getUser(username) {
  return new Promise((resolve, reject) => {
    database.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

async function authenticate(token) {
  jwt.verify(token, jwttoken, (err, id) => {
    if (err) {
      return false;
    }
    return id;
  });
}

async function addremove(add, id, token) {
  if (add) {
    database.run(
      `
    INSERT INTO sessions (id, token) VALUES (?,?)
    `,
      [id, token],
      function (err) {
        if (err) {
          return false;
        }
        return true;
      }
    );
  } else {
    database.run(
      `
    DELETE FROM sessions WHERE id = $1
    `,
      [id],
      function (err) {
        if (err) {
          return false;
        }
        return true;
      }
    );
  }
}

async function addUser(username, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    database.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// Weather API
let weatherData = { current: {} };

async function fetchWeather() {
  try {
    const response = await fetch(
      "http://api.weatherapi.com/v1/current.json?key=c2fca2c38b884246bc2104149252303&q=Brovary&aqi=no"
    );
    weatherData = await response.json();
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

fetchWeather();
setInterval(fetchWeather, 1000 * 60 * 3);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "browser.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/account", (req, res) => {
  const auth = req.headers["auth"];
  const token = auth && auth.split(" ")[1];
  const successful = authenticate(token);
  if (!successful) {
    res.sendFile(path.join(__dirname, "public", "notloged.html"));
  } else {
    res.sendFile(path.join(__dirname, "public", "account.html"));
  }
});

app.post("/weather", (req, res) => {
  res.json(weatherData.current);
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!password) {
      return res.status(400).send("Password is required");
    }

    const user = await getUser(username);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid password");
    }
    const id = user.id;
    const token = jwt.sign({ id }, jwttoken, { exp: "15m" });
    const updatetoken = jwt.sign({ id }, jwttoken, { exp: "3d" });
    addremove(true, id, updatetoken);
    res.status(200).json({ success: true, jwt: token, updjwt: updatetoken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }

    const existingUser = await getUser(username);
    if (existingUser) {
      return res.status(409).send("Username already exists");
    }

    const userId = await addUser(username, password);

    const token = jwt.sign({ userId }, jwttoken, { exp: "15m" });
    const updatetoken = jwt.sign({ userId }, jwttoken, { exp: "3d" });
    addremove(true, userId, updatetoken);
    res.status(200).json({ success: true, jwt: token, updjwt: updatetoken });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).send(err.message || "Internal server error");
  }
});

// Error handling
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
