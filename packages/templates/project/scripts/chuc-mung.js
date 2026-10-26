// "Chúc mừng": three lines of wishes, 1–3 photos in polaroid frames, confetti, 12 seconds.
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var photos = T.photos(vars);
  var COLOURS = ["#ffffff", "#ffe066", "#7bdff2", "#b892ff", "#ff5d8f"];

  function photoBox(target, src) {
    if (!target) return;
    if (src) {
      var img = document.createElement("img");
      img.src = src;
      img.alt = "";
      target.appendChild(img);
    } else {
      var empty = document.createElement("div");
      empty.className = "empty";
      target.appendChild(empty);
    }
  }

  // Confetti: fixed columns and delays, so every render shows the same flakes.
  var confetti = document.getElementById("confetti");
  for (var i = 0; i < 26; i += 1) {
    var flake = document.createElement("span");
    flake.className = "confetti";
    flake.style.left = ((i * 83) % 1040) + "px";
    flake.style.background = COLOURS[i % COLOURS.length];
    flake.style.animation = "fall " + (4.2 + (i % 5) * 0.55) + "s linear " + ((i * 0.37) % 7.5) + "s both";
    confetti.appendChild(flake);
  }

  photoBox(document.getElementById("photo-a"), photos[0]);
  photoBox(document.getElementById("photo-b"), photos[1] || photos[0]);
  var collage = document.getElementById("collage");
  var tiles = photos.length > 0 ? photos : [""];
  tiles.forEach(function (src, index) {
    var tile = document.createElement("div");
    tile.className = "tile";
    tile.id = "tile-" + (index + 1);
    photoBox(tile, src);
    collage.appendChild(tile);
    T.animate(tile, "rise", 8.2 + index * 0.25, 0.7);
  });
  if (tiles.length === 1) {
    var only = document.getElementById("tile-1");
    only.style.left = "235px";
    only.style.top = "120px";
  }

  T.setLine(document.getElementById("line1"), T.text(vars, "line1"), 104, 58);
  T.setLine(document.getElementById("line2"), T.text(vars, "line2"), 104, 58);
  T.setLine(document.getElementById("line3"), T.text(vars, "line3"), 116, 62);

  // The first frame is the thumbnail on social players: scene 1 is on screen from 0 s.
  T.animate(document.getElementById("scene-1"), "scene-out", 3.7, 0.4, "ease-in");
  T.animateAll(document.getElementById("scene-2"), [["scene-in", 4, 0.4], ["scene-out", 7.7, 0.4, "ease-in"]]);
  T.animateAll(document.getElementById("scene-3"), [["scene-in", 8, 0.4]]);
  T.animate(document.getElementById("photo-a"), "pop", 0, 0.8);
  document.getElementById("photo-a").style.setProperty("--tilt", "-4deg");
  T.animate(document.getElementById("photo-b"), "pop", 4.2, 0.8);
  document.getElementById("photo-b").style.setProperty("--tilt", "3deg");
  T.animate(document.getElementById("line2"), "rise", 4.7, 0.7);
  T.animate(document.getElementById("line3"), "rise", 8.9, 0.8);
})();
