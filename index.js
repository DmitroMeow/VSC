const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Home</title>
            </head>
            <body>
                <h1>Welcome to the home page</h1>
            </body>
        </html>
        `);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});