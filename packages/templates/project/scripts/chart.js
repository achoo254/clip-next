// Chart layout: a Tử Vi birth chart as a card, 18 seconds. Scene 1: the zodiac animal in the medallion and line 1;
// scene 2: the major star of Mệnh (or, without one, the cục emblem) in the medallion and line 2; scene 3: the three
// pictures in a row and the reading, held long enough to be read. The pictures are chosen by id among the theme's
// own files (the catalog whitelists the ids).
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var DIR = document.getElementById("stage").getAttribute("data-theme-dir");
  // Defence in depth: whatever the variable holds, only a plain lowercase id may become part of a path.
  var ID = /^[a-z]+(-[a-z]+)*$/;

  /** Path of the theme picture `<kind>-<id>.webp`, or "" when the variable holds no usable id. */
  function picture(kind) {
    var id = T.text(vars, kind);
    return ID.test(id) ? DIR + kind + "-" + id + ".webp" : "";
  }

  /** Adds an image of `src` to `parent` (nothing when there is no picture: an image without a source fails the render). */
  function addImage(parent, src, className) {
    if (!src || !parent) return null;
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    if (className) img.className = className;
    parent.appendChild(img);
    return img;
  }

  var animal = picture("animal");
  var star = picture("star");
  var cuc = picture("cuc");

  var hero = document.getElementById("hero");
  var first = addImage(hero, animal, "pic");
  var second = addImage(hero, star || cuc, "pic");
  var badge = document.getElementById("cuc-badge");
  if (star) addImage(badge, cuc, "");
  var row = document.getElementById("row");
  [animal, star, cuc].forEach(function (src, index) {
    T.animate(addImage(row, src, ""), "pop", 7.5 + index * 0.2, 0.6);
  });

  var name = T.text(vars, "name");
  var nameEl = document.getElementById("name");
  nameEl.textContent = name;
  if (name === "") nameEl.className = "empty";

  var line1 = T.text(vars, "line1");
  T.setLine(document.getElementById("line1"), line1, 92, 56);
  T.setLine(document.getElementById("line2"), T.text(vars, "line2"), 100, 60);
  T.setLine(document.getElementById("reading"), T.text(vars, "reading"), 72, 50);
  document.getElementById("line1-again").textContent = line1;

  // The first frame is the thumbnail on social players: scene 1 is on screen from 0 s.
  T.animate(document.getElementById("scene-1"), "scene-out", 3.4, 0.4, "ease-in");
  T.animate(first, "scene-out", 3.4, 0.4, "ease-in");
  T.animate(second, "pop", 3.7, 0.8);
  T.animateAll(document.getElementById("scene-2"), [["scene-in", 3.6, 0.4], ["scene-out", 6.9, 0.4, "ease-in"]]);
  T.animate(hero, "scene-out", 6.9, 0.4, "ease-in");
  T.animate(badge, "pop", 4.5, 0.6);
  T.animate(document.getElementById("line2"), "rise", 4, 0.7);
  T.animateAll(document.getElementById("scene-3"), [["scene-in", 7.2, 0.4]]);
  T.animate(document.getElementById("card"), "rise", 7.5, 0.8);

  T.animate(document.getElementById("sticker-1"), "sticker-in", 0.4, 0.6);
  T.animate(document.getElementById("sticker-2"), "sticker-in", 0.8, 0.6);
  T.animate(document.getElementById("sticker-3"), "sticker-in", 1.2, 0.6);
})();
