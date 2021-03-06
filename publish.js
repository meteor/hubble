if (Meteor.isServer) {
  var issueBoxFields = {
      repoOwner: 1,
      repoName: 1,
      "issueDocument.id": 1,
      "issueDocument.htmlUrl": 1,
      "issueDocument.number" : 1,
      "issueDocument.open" : 1,
      "issueDocument.title" : 1,
      "issueDocument.body" : 1,
      "issueDocument.labels" : 1,
      "issueDocument.user" : 1,
      "issueDocument.hasProjectLabel" : 1,
      "recentCommentsCount" : 1,
      lastUpdateOrComment: 1,
      highlyActive: 1,
      status: 1,
      canBeSnoozed: 1,
      claimedBy: 1
    };

  Meteor.publish('issues-by-status', function (status) {
    check(status, String);
    return Issues.find({
      status: status
    }, { fields: issueBoxFields });
  });

  Meteor.publish('unlabeled-open', function () {
    return Issues.find({
      'issueDocument.open': true,
      'issueDocument.hasProjectLabel': false
    }, { fields: issueBoxFields });
  });

  Meteor.publish('status-counts', function (tags) {
    check(tags, Match.OneOf([String], null));
    var self = this;
    var countsByStatus = {};

    // Increment a given status, or set it to 1 if it doesn't exist.
    var incrementStatus = function (status) {
      if (!_.has(countsByStatus, status)) {
        countsByStatus[status] = 1;
        if (initializing) return;
        self.added("counts", status, { count: 1 });
      } else {
        countsByStatus[status]++;
        if (initializing) return;
        self.changed("counts", status, { count: countsByStatus[status] });
      }
    };

    // Decrement a given status.
    var decrementStatus = function (status) {
      countsByStatus[status]--;
      self.changed("counts", status, { count: countsByStatus[status] });
    };

    var initializing = true;

    var finder = constructTagFilter(tags);
    var handle = Issues.find(finder, { fields: { status: 1 } }).observe({
      added: function (doc) {
        if (! doc.status) return;
        incrementStatus(doc.status);
      },
      changed: function (newDoc, oldDoc) {
        if (newDoc.status === oldDoc.status) return;
        oldDoc.status && decrementStatus(oldDoc.status);
        newDoc.status && incrementStatus(newDoc.status);
      },
      removed: function (oldDoc) {
        oldDoc.status && decrementStatus(oldDoc.status);
      }
    });

    initializing = false;

    _.each(countsByStatus, function (value, key) {
      self.added("counts", key, { count: value });
    });

    self.ready();
    self.onStop(function () {
      handle.stop();
    });
  });

  Meteor.publish('issue-recent-comments', function (id) {
    check(id, String);
    return Issues.find({ _id: id }, { fields: { recentComments: 1 } });
  });
}

var quotemeta = function (str) {
  return String(str).replace(/(\W)/g, '\\$1');
};


constructTagFilter = function(tags) {
  var goodReg = [];
  var badReg = [];
  _.each(tags, function (tag) {
    // If you're midway through typing a negative tag, don't filter out
    // everything.
    if (tag === '-')
      return;
    // We want to match *any* of the good tags, and we want none of the bad
    // tags. Fortunately that's exactly how $in and $nin work.
    if (tag.match(/^-/)) {
      badReg.push(new RegExp(quotemeta(tag.slice(1)), 'i'));
    } else {
      goodReg.push(new RegExp(quotemeta(tag), 'i'));
    }
  });

  if (_.isEmpty(goodReg) && _.isEmpty(badReg)) {
    return {};
  }

  var query = {'issueDocument.labels.name': {}};
  if (goodReg.length) {
    query['issueDocument.labels.name'].$in = goodReg;
  }
  if (badReg.length) {
    query['issueDocument.labels.name'].$nin = badReg;
  }
  return query;
};
