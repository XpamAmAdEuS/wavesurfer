// @ts-nocheck
/* eslint-disable valid-jsdoc */
export default (
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  ((callback, element) => setTimeout(callback, 1000 / 60))
).bind(window);
