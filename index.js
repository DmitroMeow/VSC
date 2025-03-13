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
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: rgb(14, 16, 31);
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        h1 {
            color: rgb(58, 102, 198);
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>Hiiiii :3</h1>
</body>
</html>

        `);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});