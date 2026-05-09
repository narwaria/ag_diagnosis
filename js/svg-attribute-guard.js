(function () {
  if (!window.SVGElement || window.__agSvgAttributeGuard) {
    return;
  }

  window.__agSvgAttributeGuard = true;

  const guardedAttributes = new Set(['width', 'height']);
  const originalSetAttribute = window.SVGElement.prototype.setAttribute;
  const originalSetAttributeNS = window.SVGElement.prototype.setAttributeNS;

  function normalizeSvgLength(name, value) {
    if (guardedAttributes.has(String(name).toLowerCase()) && String(value).trim() === 'auto') {
      return '100%';
    }

    return value;
  }

  window.SVGElement.prototype.setAttribute = function (name, value) {
    return originalSetAttribute.call(this, name, normalizeSvgLength(name, value));
  };

  window.SVGElement.prototype.setAttributeNS = function (namespace, name, value) {
    return originalSetAttributeNS.call(this, namespace, name, normalizeSvgLength(name, value));
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('svg[width="auto"], svg[height="auto"]').forEach(function (svg) {
      if (svg.getAttribute('width') === 'auto') {
        svg.setAttribute('width', '100%');
      }

      if (svg.getAttribute('height') === 'auto') {
        svg.setAttribute('height', '100%');
      }
    });
  });
})();
