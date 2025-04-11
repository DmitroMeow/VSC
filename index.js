const express = require("express");
require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const jwttoken = process.env.jwttoken;
const cookieParser = require("cookie-parser");
app.use(cookieParser());
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
  try {
    return jwt.verify(token, jwttoken);
  } catch (err) {
    return false;
  }
}

async function check(req) {
  const token = req.cookies.dmitromeowwebjwt;
  if (!token) return false;
  return authenticate(token);
}

async function addremove(add, id, token) {
  return new Promise((resolve, reject) => {
    if (add) {
      // Remove any existing session for the same id
      database.run("DELETE FROM sessions WHERE id = ?", [id], function (err) {
        if (err) return reject(err);

        // Insert the new session
        database.run(
          "INSERT INTO sessions (id, token) VALUES (?, ?)",
          [id, token],
          function (err) {
            if (err) return reject(err);
            console.log("Session added");
            resolve(true);
          }
        );
      });
    } else {
      // Remove the session
      database.run("DELETE FROM sessions WHERE id = ?", [id], function (err) {
        if (err) return reject(err);
        console.log("Session removed");
        resolve(true);
      });
    }
  });
}

async function UpdateJWT(req) {
  return new Promise((resolve, reject) => {
    if (!check(req)) {
      const updatetoken = req.cookies.dmitromeowwebjwtupd;
      if (!updatetoken) return reject(false);
      const decoded = authenticate(updatetoken);
      if (!decoded) return reject(false);
      const userId = decoded.userId;
      database.get(
        "SELECT * FROM sessions WHERE id = ?",
        [userId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject(false); // Session not found
          const updjwt = jwt.sign({ userId }, jwttoken, { expiresIn: "3d" });
          const jwt = jwt.sign({ userId }, jwttoken, { expiresIn: "15m" });
          // Update the session with the new token
          database.run(
            "UPDATE sessions SET token = ? WHERE id = ?",
            [updjwt, userId],
            function (err) {
              if (err) return reject(err);
              resolve(updjwt, jwt);
            }
          );
        }
      );
    }
    reject(false);
  });
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
let lastWeatherUpdate = 0;

async function fetchWeather() {
  try {
    if (Date.now() - lastWeatherUpdate < 180000) return; // 3 minute cache

    const response = await fetch(process.env.weatherapi);
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);

    const data = await response.json();
    if (!data || !data.current) throw new Error("Invalid weather data");

    weatherData = data;
    lastWeatherUpdate = Date.now();
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  const logged = check(req);
  const { updjwt, jwt } = UpdateJWT(req);
  if (updjwt) {
    res.cookie("dmitromeowwebjwtupd", updjwt, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 3,
      sameSite: "Strict",
    });
    res.cookie("dmitromeowwebjwt", jwt, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 15,
      sameSite: "Strict",
    });
  }
  if (!logged) {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
  }
  res.sendFile(path.join(__dirname, "public", "browser.html"));
});

app.get("/signup", (req, res) => {
  const logged = check(req);
  if (!logged) {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
  }
  res.redirect("/account");
});

app.get("/login", (req, res) => {
  const logged = check(req);
  if (!logged) {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  }
  res.redirect("/account");
});

app.get("/account", (req, res) => {
  const logged = check(req);
  const { updjwt, jwt } = UpdateJWT(req);
  if (updjwt) {
    res.cookie("dmitromeowwebjwtupd", updjwt, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 3,
      sameSite: "Strict",
    });
    res.cookie("dmitromeowwebjwt", jwt, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 15,
      sameSite: "Strict",
    });
  }
  if (!logged) {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
  }
  res.sendFile(path.join(__dirname, "public", "account.html"));
});

//app.get("/weather", (req, res) => {
//  fetchWeather();
//  res.send(weatherData.current);
//});

app.get("/admin_check-database", (req, res) => {
  const token = check(req); // Read the cookie
  if (!token) {
    return res.status(401).send("Heyy!! YOU ARE NOT AUTHORIZED TO DO THIS!!");
  }
  if (!token) {
    return res.status(401).send("Token outdated");
  }
  if (token.userId === 1) {
    database.all(`SELECT username, id FROM users`, (err, rows) => {
      res.send(JSON.stringify(rows));
    });
  }
});

app.get("/token", (req, res) => {
  const token = check(req); // Read the cookie
  if (!token) {
    return res.status(401).send("No token");
  }
  if (!token) {
    return res.status(401).send("Token outdated");
  }
  if (token.userId === 1) {
    return res.status(200).send("Token is valid");
  }
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
    const userId = user.id;

    const token = jwt.sign({ userId }, jwttoken, { expiresIn: "15m" });
    const updatetoken = jwt.sign({ userId }, jwttoken, { expiresIn: "3d" });
    res.cookie("dmitromeowwebjwt", token, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 15,
      sameSite: "Strict",
    });
    res.cookie("dmitromeowwebjwtupd", updatetoken, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 3,
      sameSite: "Strict",
    });
    await addremove(true, userId, updatetoken);
    res.status(200).json("Successfully logined up");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).send("Invalid username");
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).send("Username must be alphanumeric");
    }
    if (!password || password.length < 8) {
      return res.status(400).send("Password must be 8+ chars");
    }
    const existingUser = await getUser(username);
    if (existingUser) {
      return res.status(409).send("Username already exists");
    }

    const userId = await addUser(username, password);

    const token = jwt.sign({ userId }, jwttoken, { expiresIn: "15m" });
    const updatetoken = jwt.sign({ userId }, jwttoken, { expiresIn: "3d" });
    res.cookie("dmitromeowwebjwt", token, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 15,
      sameSite: "Strict",
    });
    res.cookie("dmitromeowwebjwtupd", updatetoken, {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 3,
      sameSite: "Strict",
    });
    await addremove(true, userId, updatetoken);
    res.status(200).json("Successfully signed up");
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
