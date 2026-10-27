// Shared helpers of the Clip compositions. Everything here is deterministic: no clock, no randomness, no
// network, so a frame looks the same in the browser preview and in the render.
(function () {
  "use strict";

  /** The composition's variables: declared defaults merged with the values of this render. */
  function variables() {
    var api = window.__hyperframes;
    return api && typeof api.getVariables === "function" ? api.getVariables() : {};
  }

  /** A variable as trimmed text ("" when missing or not a string). */
  function text(vars, id) {
    var value = vars[id];
    return typeof value === "string" ? value.trim() : "";
  }

  /** Font size for a line of `length` characters: long lines get smaller, never below `min`. */
  function fontSizeFor(length, max, min) {
    if (length <= 14) return max;
    var size = Math.round(max * Math.sqrt(14 / length));
    return Math.max(min, size);
  }

  /** Writes `value` into the element as text and sizes it by its length. */
  function setLine(el, value, max, min) {
    if (!el) return;
    el.textContent = value;
    el.style.fontSize = fontSizeFor(value.length, max, min) + "px";
  }

  /** The photo paths given to this render, in order, without the empty ones. */
  function photos(vars) {
    return ["photo1", "photo2", "photo3"]
      .map(function (id) { return text(vars, id); })
      .filter(function (src) { return src !== ""; });
  }

  /** Runs a CSS animation from `start` for `duration` seconds of composition time. */
  function animate(el, name, start, duration, easing) {
    if (!el) return;
    el.style.animation = name + " " + duration + "s " + (easing || "ease-out") + " " + start + "s both";
  }

  /**
   * Several CSS animations on one element: each item is [name, start, duration, easing?, fill?]. Only the first
   * should fill backwards: a later one filling backwards would hold its start state over the earlier ones.
   */
  function animateAll(el, items) {
    if (!el) return;
    el.style.animation = items
      .map(function (item, index) {
        var fill = item[4] || (index === 0 ? "both" : "forwards");
        return item[0] + " " + item[2] + "s " + (item[3] || "ease-out") + " " + item[1] + "s " + fill;
      })
      .join(", ");
  }

  /**
   * Shows the background the person chose: variable `background` is its 1-based index among the theme's pictures
   * (bg.webp, bg-2.webp, …; the catalog validates it). Anything but a plain index keeps the first one. The blurred
   * backdrop of the 4:5 and square formats (#backdrop) follows it.
   */
  function useBackground(vars) {
    var n = text(vars, "background");
    if (!/^[1-9][0-9]?$/.test(n) || n === "1") return;
    ["bg", "backdrop"].forEach(function (id) {
      var img = document.getElementById(id);
      if (img) img.setAttribute("src", img.getAttribute("src").replace(/bg\.webp$/, "bg-" + n + ".webp"));
    });
  }

  useBackground(variables());

  window.ClipTemplate = {
    variables: variables,
    text: text,
    setLine: setLine,
    photos: photos,
    animate: animate,
    animateAll: animateAll,
  };
})();
