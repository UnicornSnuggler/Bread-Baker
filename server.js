require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');
const registerGameHandlers = require('./sockets/gameHandler');

const app = express();

app.set('trust proxy', true);

const server = http.createServer(app);
const io = new Server(server);

connectDB();

app.use(express.static(path.join(__dirname, 'public')));
registerGameHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));