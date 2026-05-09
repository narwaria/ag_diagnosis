(function () {
  if (!window.SVGElement || window.__agSvgAttributeGuard) {
    return;
  }

  window.__agSvgAttributeGuard = true;

  const guardedAttributes = new Set(['width', 'height']);
  const originalSetAttribute = window.SVGElement.prototype.setAttribute;
  const originalSetAttributeNS = window.SVGElement.prototype.setAttributeNS;
  const originalInsertAdjacentHTML = window.Element.prototype.insertAdjacentHTML;
  const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML');

  function normalizeSvgLength(name, value) {
    if (guardedAttributes.has(String(name).toLowerCase()) && String(value).trim() === 'auto') {
      return '100%';
    }

    return value;
  }

  function normalizeSvgMarkup(value) {
    if (typeof value !== 'string' || !value.includes('<svg') || !value.includes('="auto"')) {
      return value;
    }

    return value
      .replace(/\s(width|height)="auto"/gi, ' $1="100%"')
      .replace(/\s(width|height)='auto'/gi, " $1='100%'");
  }

  window.SVGElement.prototype.setAttribute = function (name, value) {
    return originalSetAttribute.call(this, name, normalizeSvgLength(name, value));
  };

  window.SVGElement.prototype.setAttributeNS = function (namespace, name, value) {
    return originalSetAttributeNS.call(this, namespace, name, normalizeSvgLength(name, value));
  };

  if (innerHTMLDescriptor && innerHTMLDescriptor.set && innerHTMLDescriptor.get) {
    Object.defineProperty(window.Element.prototype, 'innerHTML', {
      configurable: innerHTMLDescriptor.configurable,
      enumerable: innerHTMLDescriptor.enumerable,
      get: innerHTMLDescriptor.get,
      set(value) {
        innerHTMLDescriptor.set.call(this, normalizeSvgMarkup(value));
      },
    });
  }

  if (originalInsertAdjacentHTML) {
    window.Element.prototype.insertAdjacentHTML = function (position, value) {
      return originalInsertAdjacentHTML.call(this, position, normalizeSvgMarkup(value));
    };
  }

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
