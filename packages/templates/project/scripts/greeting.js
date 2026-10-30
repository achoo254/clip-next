// Greeting layout: three lines of wishes, 1–3 photos in the theme's AI-drawn frame, stickers, 12 seconds. A voiced
// video moves each scene to when its line is read (variable `cues`) and may last longer.
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var photos = T.photos(vars);
  var FRAME = document.getElementById("stage").getAttribute("data-theme-dir") + "frame.webp";
  // When scenes 2 and 3 come in.
  var at = T.cues(vars, 3, [0, 4, 8]);
  var s2 = at[1];
  var s3 = at[2];

  /** The photo (if any) under the theme's frame. */
  function framed(target, src) {
    if (!target) return;
    if (src) {
      var win = document.createElement("div");
      win.className = "window";
      var img = document.createElement("img");
      img.src = src;
      img.alt = "";
      win.appendChild(img);
      target.appendChild(win);
    }
    var frame = document.createElement("img");
    frame.className = "frame";
    frame.src = FRAME;
    frame.alt = "";
    target.appendChild(frame);
  }

  framed(document.getElementById("framed-a"), photos[0]);
  framed(document.getElementById("framed-b"), photos[1] || photos[0]);
  var collage = document.getElementById("collage");
  var tiles = photos.length > 0 ? photos : [""];
  tiles.forEach(function (src, index) {
    var tile = document.createElement("div");
    tile.className = "framed tile";
    tile.id = "tile-" + (index + 1);
    framed(tile, src);
    collage.appendChild(tile);
    T.animate(tile, "rise", s3 + 0.2 + index * 0.25, 0.7);
  });
  if (tiles.length === 1) {
    var only = document.getElementById("tile-1");
    only.style.left = "90px";
    only.style.top = "220px";
    only.style.width = "900px";
    only.style.height = "900px";
  }

  T.setLine(document.getElementById("line1"), T.text(vars, "line1"), 104, 58);
  T.setLine(document.getElementById("line2"), T.text(vars, "line2"), 104, 58);
  T.setLine(document.getElementById("line3"), T.text(vars, "line3"), 116, 62);

  // The first frame is the thumbnail on social players: scene 1 is on screen from 0 s.
  T.animate(document.getElementById("scene-1"), "scene-out", s2 - 0.3, 0.4, "ease-in");
  T.animateAll(document.getElementById("scene-2"), [["scene-in", s2, 0.4], ["scene-out", s3 - 0.3, 0.4, "ease-in"]]);
  T.animateAll(document.getElementById("scene-3"), [["scene-in", s3, 0.4]]);
  var a = document.getElementById("framed-a");
  a.style.setProperty("--tilt", "-3deg");
  T.animate(a, "pop", 0, 0.8);
  var b = document.getElementById("framed-b");
  b.style.setProperty("--tilt", "3deg");
  T.animate(b, "pop", s2 + 0.2, 0.8);
  T.animate(document.getElementById("line2"), "rise", s2 + 0.7, 0.7);
  T.animate(document.getElementById("line3"), "rise", s3 + 0.9, 0.8);

  // Stickers: two from the start, the third joins the last scene.
  T.animate(document.getElementById("sticker-1"), "sticker-in", 0.3, 0.6);
  T.animate(document.getElementById("sticker-2"), "sticker-in", 0.6, 0.6);
  T.animate(document.getElementById("sticker-3"), "sticker-in", s3 + 0.4, 0.6);
})();
