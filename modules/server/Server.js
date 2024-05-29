const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const db = require('../../models');
const routes = require('./routes');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));

app.use(routes);

db.sequelize.sync().then(r => {}).catch(e => {console.log(e)});

module.exports = app;