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
const rateLimit = require("express-rate-limit"); //Rate limit
const { get } = require("http");
const pgp = require("pg-promise")({
  // Initialization Options
});

const cn = {
  connectionString:
    "postgresql://neondb_owner:npg_YTIMu8Ek2Ucm@ep-summer-sound-a2xoc786-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require",
  max: 30, // use up to 30 connections
};

const database = pgp(cn);

database
  .connect()
  .then((obj) => {
    obj.done(); // відключає з'єднання
    console.log("Connected to the database");
  })
  .catch((error) => {
    console.error("error to connect: ", error);
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

// User functions DATABASE
async function getUser(username) {
  return new Promise((resolve, reject) => {
    database
      .oneOrNone("SELECT * FROM users WHERE username = $1", [username])
      .then((user) => resolve(user))
      .catch((err) => reject(err));
  });
}

async function addUser(username, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    database
      .one(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
        [username, hashedPassword]
      )
      .then((data) => resolve(data.id))
      .catch((err) => reject(err));
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
    database
      .none("INSERT INTO sessions (token, userid) VALUES ($1, $2)", [token, id])
      .then(() => resolve(true))
      .catch((err) => reject(err));
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
        database
          .oneOrNone("SELECT * FROM sessions WHERE token = $1", [updatetoken])
          .then((row) => {
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
            database
              .none("UPDATE sessions SET token = $1 WHERE token = $2", [
                updjwt,
                updatetoken,
              ])
              .then(() => {
                resolve({
                  status: "updated",
                  jwt: newjwt,
                  updjwt: updjwt,
                });
              })
              .catch((err) => reject("Failed to update session"));
          })
          .catch((err) => reject("Database error"));
      });
    });
  });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const getlimiter = rateLimit({
  windowMs: 1000 * 5,
  max: 30,
  message: "Too many requests, please try again later.",
});

app.get("/weather", getlimiter, async (req, res) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=5f6f29da20324c2499e192710251004&q=${ip}&aqi=no`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.warn("❌ Weather fetch error:", error.message);
    res.status(500).json({ error: "weather error" });
  }
});

// Routes
app.get("/", getlimiter, (req, res) => {
  res.redirect("/home");
});

app.get("/home", getlimiter, (req, res) => {
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

app.get("/account/", getlimiter, (req, res) => {
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

app.get("/signup", getlimiter, (req, res) => {
  CheckORUpdateJWT(req)
    .then((response) => {
      res.redirect("/account");
    })
    .catch((why) => {
      res.sendFile(path.join(__dirname, "public", "joinus", "signup.html"));
    });
});

app.get("/login", getlimiter, (req, res) => {
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

app.post(
  "/loginreq",
  rateLimit({
    windowMs: 1000 * 20,
    max: 10,
    message: "Too many requests, please try again later.",
  }),
  async (req, res) => {
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
      const updatetoken = jwt.sign({ id: userId }, jwttoken, {
        expiresIn: "3d",
      });

      res.cookie("dmeow_access", token, jwtcookieopt);
      res.cookie("dmeow_upd", updatetoken, updjwtcookieopt);
      await addsession(userId, updatetoken);
      res.status(200).send("Successfully logined up");
    } catch (err) {
      res.status(500).send("Internal server error");
    }
  }
);

app.post(
  "/signupreq",
  rateLimit({
    windowMs: 1000 * 20,
    max: 3,
    message: "Too many requests, please try again later.",
  }),
  async (req, res) => {
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
      const updatetoken = jwt.sign({ id: userId }, jwttoken, {
        expiresIn: "3d",
      });
      res.cookie("dmeow_access", token, jwtcookieopt);
      res.cookie("dmeow_upd", updatetoken, updjwtcookieopt);
      await addsession(userId, updatetoken);
      res.status(200).send("Successfully signed up");
    } catch (err) {
      res.status(500).send(err.message || "Internal server error");
    }
  }
);

// Error handling
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
