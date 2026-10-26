// "Kể nhanh": a title, then 3–5 points one frame each, Short style, 18 seconds. The frames share the time after the
// title equally; photos (optional) take turns behind them.
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var DURATION = 18;
  var TITLE_END = 3;
  var points = ["point1", "point2", "point3", "point4", "point5"]
    .map(function (id) { return T.text(vars, id); })
    .filter(function (value) { return value !== ""; });
  var photos = T.photos(vars);
  var slot = (DURATION - TITLE_END) / Math.max(1, points.length);

  T.setLine(document.getElementById("title"), T.text(vars, "title"), 120, 64);
  // On screen from 0 s: the first frame is the thumbnail on social players.
  T.animate(document.getElementById("title-card"), "title-out", 0, TITLE_END, "linear");

  var list = document.getElementById("points");
  var backdrops = document.getElementById("backdrops");
  points.forEach(function (value, index) {
    var start = TITLE_END + index * slot;
    var card = document.createElement("section");
    card.className = "point";
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
    T.setLine(body, value, 96, 54);
    card.appendChild(head);
    card.appendChild(body);
    list.appendChild(card);
    T.animate(card, "card", start, slot, "linear");

    if (photos.length > 0) {
      var backdrop = document.createElement("div");
      backdrop.className = "backdrop";
      var img = document.createElement("img");
      img.src = photos[index % photos.length];
      img.alt = "";
      backdrop.appendChild(img);
      backdrops.appendChild(backdrop);
      T.animate(backdrop, "fade", start, slot, "linear");
    }
  });
})();
