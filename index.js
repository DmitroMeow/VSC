const jwttoken =
  "e488348269bad036160f0d9558b7c5de68163b50e1a6ce46e85ee64692eba074529a4a2b48db4d5c36496e845001e13e6d07c585eacd564defcbf719ec9033e17"; // *Secret*

const express = require("express"); //Main
const app = express(); //Deploying Main
const bcrypt = require("bcrypt"); //Passwords bcrypt
const path = require("path"); //For .public
const port = process.env.PORT || 3000; //Port
const jwt = require("jsonwebtoken"); //Auth
const cookieParser = require("cookie-parser"); //Give cookie
app.use(cookieParser()); // Use cookies
const pgp = require("pg-promise")(/*options*/);
const database = pgp(
  "postgresql://neondb_owner:npg_YTIMu8Ek2Ucm@ep-summer-sound-a2xoc786-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
);

database
  .connect()
  .then((obj) => {
    obj.done(); // відключає з'єднання
    console.log("Підключення успішне!");
  })
  .catch((error) => {
    console.error("Помилка підключення:", error);
  });

//Cookies options
const jwtcookieopt = {
  httpOnly: true,
  secure: true,
  maxAge: 1000 * 60 * 15,
  sameSite: "Strict",
};
const updjwtcookieopt = {
  httpOnly: true,
  secure: true,
  maxAge: 1000 * 60 * 60 * 24 * 3,
  sameSite: "Strict",
};

try {
  database.any(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);
  database.any(`
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY,
 userid INTEGER NOT NULL
)
`);
} catch (err) {
  botlog("Database setup error: " + err.message);
}
// User functions DATABASE
async function getUser(username) {
  return new Promise((resolve, reject) => {
    database.oneOrNone(
      "SELECT * FROM users WHERE username = ?",
      [username],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

async function addUser(username, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    database.any(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}
//User functions JSON WEB TOKEN

async function authenticate(token) {
  //Auth web token to data
  try {
    return jwt.verify(token, jwttoken);
  } catch (err) {
    return false;
  }
}

async function addsession(id, token) {
  return new Promise((resolve, reject) => {
    database.any(
      "INSERT INTO sessions (token, userid) VALUES (?, ?)",
      [token, id],
      function (err) {
        if (err) botlog(err.message || err);
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function CheckORUpdateJWT(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies.dmeow_access;

    // Authenticate the access token
    authenticate(token).then((decodedAccess) => {
      if (decodedAccess) {
        return resolve(decodedAccess);
      }

      const updatetoken = req.cookies.dmeow_upd;
      if (!updatetoken) {
        return reject("No update token");
      }
      // Authenticate the update token
      authenticate(updatetoken).then((decodedUpdate) => {
        if (!decodedUpdate) {
          return reject("Invalid update token");
        }

        const userId = decodedUpdate.id;

        // Check if the session exists for the update token
        database.any(
          "SELECT * FROM sessions WHERE token = ?",
          [updatetoken],
          (err, row) => {
            if (err) {
              botlog(err.message || err);
              return reject("Database error");
            }

            if (!row) {
              return reject("Session not exists");
            }

            // Generate new tokens
            const updjwt = jwt.sign({ id: userId }, jwttoken, {
              expiresIn: "3d",
            });
            const newjwt = jwt.sign({ id: userId }, jwttoken, {
              expiresIn: "15m",
            });

            // Update the session with the new update token
            database.any(
              "UPDATE sessions SET token = ? WHERE token = ?",
              [updjwt, updatetoken],
              function (err) {
                if (err) {
                  botlog(err.message || err);
                  return reject("Failed to update session");
                }

                resolve({
                  status: "updated",
                  jwt: newjwt,
                  updjwt: updjwt,
                });
              }
            );
          }
        );
      });
    });
  });
}
let weather = { current: { temp_c: "..", condition: { icon: "" } } }; // Change const to let
let lastfetch = 0; // Change const to let

async function fetchWeather() {
  if (lastfetch > Date.now() - 3 * 60 * 1000) {
    return weather;
  }
  const response = await fetch(
    "https://api.weatherapi.com/v1/current.json?key=5f6f29da20324c2499e192710251004&q=Brovary&aqi=no",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  const data = await response.json();
  weather = data; // Now this reassignment will work
  lastfetch = Date.now();
  return weather;
}
// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/weather", async (req, res) => {
  try {
    const weatherData = await fetchWeather();
    res.json(weatherData);
  } catch (err) {
    console.error("Weather fetch error:", err);
    res.status(500).send("Failed to fetch weather data");
  }
});

// Routes
app.get("/home", (req, res) => {
  CheckORUpdateJWT(req)
    .then((response) => {
      if (response.jwt && response.updjwt) {
        res.cookie("dmeow_access", response.jwt, jwtcookieopt);
        res.cookie("dmeow_upd", response.updjwt, updjwtcookieopt);
      }
      res.sendFile(path.join(__dirname, "public", "homepage", "index.html"));
    })
    .catch((why) => {
      res.redirect("/login");
    });
});

app.get("/account/", (req, res) => {
  CheckORUpdateJWT(req)
    .then((response) => {
      if (response.jwt && response.updjwt) {
        res.cookie("dmeow_access", response.jwt, jwtcookieopt);
        res.cookie("dmeow_upd", response.updjwt, updjwtcookieopt);
      }
      res.sendFile(path.join(__dirname, "public", "account", "index.html"));
    })
    .catch((why) => {
      res.redirect("/login");
    });
});

app.get("/signup", (req, res) => {
  CheckORUpdateJWT(req)
    .then((response) => {
      res.redirect("/account");
    })
    .catch((why) => {
      res.sendFile(path.join(__dirname, "public", "joinus", "signup.html"));
    });
});

app.get("/login", (req, res) => {
  CheckORUpdateJWT(req)
    .then((response) => {
      res.redirect("/account");
    })
    .catch((why) => {
      res.sendFile(path.join(__dirname, "public", "joinus", "login.html"));
    });
});

// app.get("/token", (req, res) => {
//   CheckORUpdateJWT(req)
//     .then((response) => {
//       if (response.jwt && response.updjwt) {
//         res.cookie("dmeow_access", response.jwt, jwtcookieopt);
//         res.cookie("dmeow_upd", response.updjwt, updjwtcookieopt);
//       }
//       res.send("TOKEN_ACTIVE");
//     })
//     .catch((why) => {
//       res.send(why);
//     });
// });

app.post("/loginreq", async (req, res) => {
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

    const token = jwt.sign({ id: userId }, jwttoken, { expiresIn: "15m" });
    const updatetoken = jwt.sign({ id: userId }, jwttoken, { expiresIn: "3d" });

    res.cookie("dmeow_access", token, jwtcookieopt);
    res.cookie("dmeow_upd", updatetoken, updjwtcookieopt);
    await addsession(userId, updatetoken);
    res.status(200).send("Successfully logined up");
  } catch (err) {
    botlog("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

app.post("/signupreq", async (req, res) => {
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

    const token = jwt.sign({ id: userId }, jwttoken, { expiresIn: "15m" });
    const updatetoken = jwt.sign({ id: userId }, jwttoken, { expiresIn: "3d" });
    res.cookie("dmeow_access", token, jwtcookieopt);
    res.cookie("dmeow_upd", updatetoken, updjwtcookieopt);
    await addsession(userId, updatetoken);
    res.status(200).send("Successfully signed up");
  } catch (err) {
    botlog("Signup error:", err);
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
  botlog(`Server running on port ${port}`);
});
