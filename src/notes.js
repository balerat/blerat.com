/* Notes: a ~100-line markdown renderer plus the list/article pages.
   Supports: # headings, paragraphs, **bold**, *italic*, `code`,
   fenced ``` blocks, [links](url), ![images](src), - and 1. lists,
   > blockquotes, --- rules, $inline$ and $$display$$ math (KaTeX).
   That's it, on purpose. */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Placeholders use \u0000 sentinels, which cannot appear in markdown text. */

function mdInline(s) {
  var codes = [];
  s = s.replace(/`([^`]+)`/g, function (_, c) {
    codes.push('<code>' + c + '</code>');
    return '\u0000C' + (codes.length - 1) + '\u0000';
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s.replace(/\u0000C(\d+)\u0000/g, function (_, n) { return codes[n]; });
}

function renderMath(tex, display) {
  if (window.katex) {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false });
  }
  return '<code>' + escapeHtml(tex) + '</code>';
}

function mdToHtml(src) {
  src = src.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');

  var blocks = [];
  src = src.replace(/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g, function (_, lang, code) {
    var cls = lang ? ' class="language-' + lang + '"' : '';
    blocks.push('<pre><code' + cls + '>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre>');
    return '\u0000B' + (blocks.length - 1) + '\u0000';
  });

  /* Math is pulled out before escaping so TeX survives untouched.
     Inline code spans are matched too, and left alone, so `$x` stays code. */
  var maths = [];
  src = src.replace(/`[^`\n]+`|\$\$([\s\S]+?)\$\$|\$([^\s$](?:[^$\n]*[^\s$])?)\$/g,
    function (m, display, inline) {
      if (m[0] === '`') return m;
      maths.push(display !== undefined ? { tex: display.trim(), display: true } : { tex: inline, display: false });
      return '\u0000M' + (maths.length - 1) + '\u0000';
    });

  src = escapeHtml(src);

  var lines = src.split('\n');
  var out = [];
  var i = 0;

  while (i < lines.length) {
    var line = lines[i];
    var m;

    if (/^\s*$/.test(line)) { i++; continue; }

    if ((m = line.match(/^\u0000B(\d+)\u0000\s*$/))) {
      out.push(blocks[+m[1]]);
      i++;
    } else if ((m = line.match(/^\u0000M(\d+)\u0000\s*$/)) && maths[+m[1]].display) {
      out.push('<div class="math-display">\u0000M' + m[1] + '\u0000</div>');
      i++;
    } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      var lvl = m[1].length;
      out.push('<h' + lvl + '>' + mdInline(m[2]) + '</h' + lvl + '>');
      i++;
    } else if (/^(---+|\*\*\*+)\s*$/.test(line)) {
      out.push('<hr>');
      i++;
    } else if (/^&gt;\s?/.test(line)) {
      var quote = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^&gt;\s?/, ''));
        i++;
      }
      out.push('<blockquote><p>' + mdInline(quote.join(' ')) + '</p></blockquote>');
    } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      var ordered = /^\d+\.\s+/.test(line);
      var pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      var items = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push('<li>' + mdInline(lines[i].replace(pattern, '')) + '</li>');
        i++;
      }
      var tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + '>' + items.join('') + '</' + tag + '>');
    } else {
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,4}\s|&gt;|[-*]\s|\d+\.\s|---|\u0000B)/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push('<p>' + mdInline(para.join(' ')) + '</p>');
    }
  }

  return out.join('\n').replace(/\u0000M(\d+)\u0000/g, function (_, n) {
    return renderMath(maths[n].tex, maths[n].display);
  });
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'section';
}

/* Give h2/h3 ids and a hover "#" permalink. */
function addAnchors(el) {
  var used = {};
  el.querySelectorAll('h2, h3').forEach(function (h) {
    var id = slugify(h.textContent);
    if (used[id]) id += '-' + (++used[id]); else used[id] = 1;
    h.id = id;
    var a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + id;
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    h.insertBefore(a, h.firstChild);
  });
}

function readingTime(md) {
  var words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

/* ---- Page wiring ---- */

function renderNoteList(el) {
  fetch('../notes/index.json')
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (notes) {
      notes.sort(function (a, b) { return b.date.localeCompare(a.date); });
      if (!notes.length) {
        el.innerHTML = '<p>No notes yet.</p>';
        return;
      }
      el.innerHTML = notes.map(function (n) {
        return '<article class="project">' +
          '<div class="project-head">' +
          '<h3><a href="note.html?f=' + encodeURIComponent(n.file) + '">' + escapeHtml(n.title) + '</a></h3>' +
          '<span class="dates">' + escapeHtml(n.date) + '</span>' +
          '</div>' +
          (n.summary ? '<p>' + escapeHtml(n.summary) + '</p>' : '') +
          '</article>';
      }).join('');
    })
    .catch(function () {
      el.innerHTML = '<p>Could not load the notes index.</p>';
    });
}

function renderNote(el) {
  var f = new URLSearchParams(location.search).get('f') || '';
  if (!/^[A-Za-z0-9._-]+\.md$/.test(f)) {
    el.innerHTML = '<p>Note not found. Back to <a href="blog.html">notes</a>.</p>';
    return;
  }
  fetch('../notes/' + f)
    .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
    .then(function (md) {
      el.innerHTML = mdToHtml(md);
      addAnchors(el);
      if (window.hljs) el.querySelectorAll('pre code').forEach(function (c) { hljs.highlightElement(c); });
      var h1 = el.querySelector('h1');
      if (h1) document.title = h1.textContent + ' — blerat.com';
      return fetch('../notes/index.json').then(function (r) { return r.json(); }).then(function (idx) {
        var entry = idx.find(function (n) { return n.file === f; });
        if (entry && h1) {
          var date = document.createElement('p');
          date.className = 'subtitle';
          date.textContent = entry.date + ' \u00b7 ' + readingTime(md);
          h1.insertAdjacentElement('afterend', date);
        }
        if (location.hash) {
          var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
          if (target) target.scrollIntoView();
        }
      });
    })
    .catch(function () {
      el.innerHTML = '<p>Could not load this note. Back to <a href="blog.html">notes</a>.</p>';
    });
}

document.addEventListener('DOMContentLoaded', function () {
  var list = document.getElementById('note-list');
  var article = document.getElementById('note-article');
  if (list) renderNoteList(list);
  if (article) renderNote(article);
});
