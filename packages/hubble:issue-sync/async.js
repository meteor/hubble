// P is the only non-export package-local. Other things that would be
// package-local will go on it.
P = {};

var Future = Npm.require('fibers/future');

P.async = Npm.require('async');

// Need this to enable async.waterfall.
var savedAsyncSetImmediate = P.async.setImmediate;
P.async.setImmediate = function (fn) {
  savedAsyncSetImmediate(Meteor.bindEnvironment(fn));
};

P.asyncMethod = function (name, body) {
  var m = {};
  m[name] = function () {
    var self = this;
    var f = new Future;
    var args = _.toArray(arguments);
    // minus 1 because the last arg is the callback
    if (args.length !== body.length - 1) {
      throw new Meteor.Error(400, "Expected " + (body.length - 1) + " args");
    }
    args.push(f.resolver());
    body.apply(self, args);
    return f.wait();
  };
  Meteor.methods(m);
};

// Like async.series but returning null instead of an array of results; or like
// "eachSeries but the iterator is just calling the function".
P.asyncVoidSeries = function (arr, cb) {
  P.async.eachSeries(arr, function (task, cb) {
    task(cb);
  }, cb);
};

P.requireLoggedIn = function (cb) {
  cb(Meteor.userId() ? null : new Meteor.Error("Must be logged in"));
};
