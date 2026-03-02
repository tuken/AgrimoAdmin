const path = require('path');
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
require('dotenv').config();

// ------------------------------------------------------------
// Polyfill fetch for Node.js environments that don't have it.
// - Node 18+: global fetch exists
// - Node <=17: provide node-fetch (v2, CommonJS)
// ------------------------------------------------------------
if (typeof global.fetch !== 'function') {
  // eslint-disable-next-line global-require
  global.fetch = require('node-fetch');
}

const indexRouter = require('./routes/index');
const fieldRouter = require("./routes/field");
const reportRouter = require("./routes/report");
const userRouter = require("./routes/user");

const topRouter = require('./routes/top');
const authRouter = require('./routes/auth');
const graphqlRouter = require('./routes/graphql');
const accountRouter = require('./routes/account');

const { createSessionStore } = require('./db/sessionStore');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

const isProd = process.env.NODE_ENV === 'production';

// Session (MySQL-backed)
// NOTE: rolling must be placed at the session option level (NOT inside cookie).
app.use(session({
  name: process.env.SESSION_NAME || 'agri.sid',
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  store: createSessionStore(),
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax', 
    secure: isProd,                  
    maxAge: Number(process.env.SESSION_COOKIE_MAXAGE_MS || 7 * 24 * 60 * 60 * 1000)
  }
}));

// locals for views
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  next();
});

// Static assets

app.use('/static', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/top', topRouter);
app.use("/", fieldRouter);
app.use("/", reportRouter);
app.use("/", userRouter);

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/account', accountRouter);
app.use('/graphql', graphqlRouter);
app.get('/health', (req, res) => res.status(200).send('ok'));

// 404
app.use((req, res) => {
  res.status(404).send('Not Found');
});

module.exports = app;
