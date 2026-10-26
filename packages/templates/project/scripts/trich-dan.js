// "Trích dẫn": one big quote and its author on a slowly moving background, 10 seconds.
(function () {
  "use strict";
  var T = window.ClipTemplate;
  var vars = T.variables();
  var author = T.text(vars, "author");

  T.setLine(document.getElementById("quote"), T.text(vars, "quote"), 110, 56);
  var authorEl = document.getElementById("author");
  authorEl.textContent = author;
  if (author === "") authorEl.className = "empty";

  // The quote is on screen from 0 s (the first frame is the thumbnail on social players); the author follows.
  T.animate(authorEl, "rise", 1.6, 0.9);
  T.animate(document.getElementById("card"), "fade-out", 9.2, 0.8, "ease-in");
})();
