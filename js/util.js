/* Helpers shared by every page. Links between pages depend on slugify being the same everywhere. */
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  // Company names: the "operators" list if given,
  // otherwise the "operator" text split at semicolons with (dates) removed.
  function operatorsOf(props) {
    var list = Array.isArray(props.operators) ? props.operators : (props.operators ? [props.operators] : []);
    if (!list.length && props.operator) {
      list = String(props.operator).split(';').map(function (s) {
        return s.replace(/\([^)]*\)/g, '').replace(/[,\s]+$/, '');
      });
    }
    return list.map(function (s) { return String(s == null ? '' : s).trim(); }).filter(Boolean);
  }

  // Pin color for each coal field (lowercase, without "Field").
  var FIELD_COLORS = {
    'northern': '#f2b63c', 'eastern middle': '#4cc3d9', 'western middle': '#ef5b5b', 'southern': '#b28dff'
  };

  window.CollieryUtil = {
    escapeHtml: escapeHtml, slugify: slugify, isHttpUrl: isHttpUrl,
    operatorsOf: operatorsOf, FIELD_COLORS: FIELD_COLORS
  };
})();
