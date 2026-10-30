// Quick-list layout: a title, then 3–5 points one frame each, Short style, 18 seconds. The frames share the time
// after the title equally; photos (optional) take turns above them. A voiced video gives each frame the time its line
// takes to read (variable `cues`) and may last longer.
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var points = ["point1", "point2", "point3", "point4", "point5"]
    .map(function (id) { return T.text(vars, id); })
    .filter(function (value) { return value !== ""; });
  var photos = T.photos(vars);
  var DURATION = T.duration();
  var slot = (DURATION - 3) / Math.max(1, points.length);
  // When the title's frame and each point's frame come in.
  var starts = T.cues(vars, 1 + points.length, [0].concat(points.map(function (_, i) { return 3 + i * slot; })));
  var TITLE_END = starts[1] || DURATION;

  T.setLine(document.getElementById("title"), T.text(vars, "title"), 120, 64);
  // On screen from 0 s: the first frame is the thumbnail on social players.
  T.animate(document.getElementById("title-card"), "title-out", 0, TITLE_END, "linear");
  T.animate(document.getElementById("sticker-1"), "sticker-out", TITLE_END - 0.4, 0.4, "linear");
  T.animate(document.getElementById("sticker-2"), "sticker-in", 0.4, 0.6);
  T.animate(document.getElementById("sticker-3"), "sticker-in", 0.8, 0.6);

  var list = document.getElementById("points");
  var shots = document.getElementById("shots");
  points.forEach(function (value, index) {
    var start = starts[index + 1];
    var length = (starts[index + 2] || DURATION) - start;
    var card = document.createElement("section");
    card.className = "panel point " + (photos.length > 0 ? "with-photo" : "text-only");
    var head = document.createElement("div");
    var num = document.createElement("span");
    num.className = "num";
    num.textContent = String(index + 1);
    var of = document.createElement("span");
    of.className = "of";
    of.textContent = "/ " + points.length;
    head.appendChild(num);
    head.appendChild(of);
    var body = document.createElement("p");
    T.setLine(body, value, photos.length > 0 ? 84 : 92, 56);
    card.appendChild(head);
    card.appendChild(body);
    list.appendChild(card);
    T.animate(card, "card", start, length, "linear");

    if (photos.length > 0) {
      var shot = document.createElement("div");
      shot.className = "shot";
      var img = document.createElement("img");
      img.src = photos[index % photos.length];
      img.alt = "";
      shot.appendChild(img);
      shots.appendChild(shot);
      T.animate(shot, "fade", start, length, "linear");
    }
  });
})();
