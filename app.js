
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , olinapps = require('olinapps')
  , mongojs = require('mongojs')
  , MongoStore = require('connect-mongo')(express);

var app = express(), db;

app.configure(function () {
  db = mongojs(process.env.MONGOLAB_URI || 'olinapps-voting', ['votes']);
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('secret', process.env.SESSION_SECRET || 'terrible, terrible secret')
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser(app.get('secret')));
  app.use(express.session({
    secret: app.get('secret'),
    store: new MongoStore({
      url: process.env.MONGOLAB_URI || 'mongodb://localhost/olinapps-voting'
    })
  }));
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
  app.set('host', 'localhost:3000');
  app.use(express.errorHandler());
});

app.configure('production', function () {
  app.set('host', 'voting.olinapps.com');
});

/**
 * Authentication
 */

app.post('/login', olinapps.login);
app.all('/logout', olinapps.logout);
app.all('/*', olinapps.middleware);
app.all('/*', olinapps.loginRequired);

app.all('/*', function (req, res, next) {
  if (olinapps.user(req).domain != 'students.olin.edu') {
    return res.send('<h1>Students only.</h1> <p>Sorry, this application is closed to non-students. Please apply for next candidates\' weekend!</p>');
  }
  next();
})

/**
 * Routes
 */

Array.prototype.randomize = function () {
  this.sort(function (a, b) { return Math.random() - 0.5; })
  return this;
};

function getPositions () {
  return {
    '2014': {
      'Representatives': [
        { name: 'Noam Rubin' },
        { name: 'Janaki' },
        { name: 'Cory Dolphin' },
        { name: 'Jordyn Burger' }
      ].randomize(),
      'Class Activity Reps': [
        { name: 'Janaki' },
        { name: 'Noam Rubin' },
        { name: 'Jordyn Burger' }
      ].randomize(),
    },
    '2015': {
      'Representatives': [
        { name: 'Brooks' },
        { name: 'James Nee' },
        { name: 'Maddie Perry' }
      ].randomize(),
    },
    '2016': {
      'Representatives': [
        { name: 'Brian' },
        { name: 'Saarth' }
      ].randomize(),
    }
  }
}

app.get('/', function (req, res) {
  db.votes.findOne({
    student: olinapps.user(req).id,
    year: 2013
  }, function (err, vote) {
    console.log(err, vote);
    res.render('index', {
      title: 'Olin Voting App',
      answers: vote ? vote.answers : {},
      positions: getPositions(),
      user: olinapps.user(req),
      saved: 'success' in req.query
    });
  });
});

app.post('/', function (req, res) {
  console.log(req.body);
  db.votes.update({
    student: olinapps.user(req).id,
    year: 2013
  }, {
    $set: {
      date: Date.now(),
      answers: req.body
    }
  }, {
    upsert: true
  }, function (err, u) {
    console.log('>>>', err, u);
    db.votes.find(function () { console.log(arguments); });
    res.redirect('/?success');
  });
})

app.get('/SECRETRESULTLINKRAW', function (req, res) {
  db.votes.find(function (err, votes) {
    res.json(votes);
  });
});

app.get('/SECRETRESULTLINK', function (req, res) {
  var poshash = {};
  db.votes.find(function (err, votes) {
    votes.forEach(function (vote) {
      Object.keys(vote.answers).forEach(function (pos) {
        poshash[pos] || (poshash[pos] = {});
        (Array.isArray(vote.answers[pos]) ? vote.answers[pos] : [vote.answers[pos]]).forEach(function (name) {
          poshash[pos][name] || (poshash[pos][name] = 0);
          poshash[pos][name]++;
        })
      })
    });
    res.json(poshash);
  });
});

/**
 * Launch
 */

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on http://" + app.get('host'));
});
