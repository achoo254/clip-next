// Quote layout: one big quote and its author on the theme's slowly moving background, 10 seconds. In a voiced video
// the author comes in once the quote has been read (variable `cues`), and the video may last longer.
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var author = T.text(vars, "author");
  var at = T.cues(vars, author === "" ? 1 : 2, [0, 1.6]);
  var authorAt = at[1] || 1.6;

  T.setLine(document.getElementById("quote"), T.text(vars, "quote"), 100, 52);
  var authorEl = document.getElementById("author");
  authorEl.textContent = author;
  if (author === "") authorEl.className = "empty";

  // The quote is on screen from 0 s (the first frame is the thumbnail on social players); the author follows.
  T.animate(authorEl, "rise", authorAt, 0.9);
  T.animate(document.getElementById("sticker-1"), "sticker-in", 0.3, 0.6);
  T.animate(document.getElementById("sticker-2"), "sticker-in", 0.8, 0.6);
  T.animate(document.getElementById("sticker-3"), "sticker-in", 2.2, 0.6);
  T.animate(document.getElementById("card"), "fade-out", T.duration() - 0.8, 0.8, "ease-in");
})();
