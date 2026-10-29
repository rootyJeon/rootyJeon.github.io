/* Recent Posts: renders X / LinkedIn posts listed in posts.json as official embeds.
 * posts.json is a JSON array; each item is a post URL string or an object
 * { "url": "...", "pin": true, "repost": true }. Cards are sorted newest-first using the
 * timestamp encoded in each post's numeric ID; pinned posts always come first, and
 * reposts get a small "Reposted" label. */
(function () {
  var strip = document.getElementById('posts-strip');
  if (!strip) return;
  var empty = document.getElementById('posts-empty');
  var MAX_POSTS = 20;
  var posts = [];

  // X and LinkedIn IDs are snowflakes: the top bits hold a millisecond timestamp.
  function snowflakeTime(id, epoch) {
    try { return Number(BigInt(id) >> 22n) + epoch; } catch (e) { return 0; }
  }

  function parsePost(url) {
    var m;
    if ((m = url.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)/))) {
      return { platform: 'x', id: m[2], url: 'https://twitter.com/' + m[1] + '/status/' + m[2],
               time: snowflakeTime(m[2], 1288834974657) };
    }
    if ((m = url.match(/linkedin\.com\/.*?(urn:li:(?:activity|share|ugcPost):(\d+))/))) {
      return { platform: 'linkedin', id: m[2], urn: m[1], url: url, time: snowflakeTime(m[2], 0) };
    }
    if ((m = url.match(/linkedin\.com\/posts\/.*?-(activity|ugcPost|share)-(\d+)/))) {
      return { platform: 'linkedin', id: m[2], urn: 'urn:li:' + m[1] + ':' + m[2], url: url,
               time: snowflakeTime(m[2], 0) };
    }
    return null;
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function render() {
    strip.innerHTML = '';
    posts.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'post-card post-card--' + p.platform;
      if (p.repost) {
        var label = document.createElement('div');
        label.className = 'post-label';
        label.innerHTML = '<i class="fa-solid fa-retweet"></i> Reposted by me';
        card.appendChild(label);
      }
      var body = document.createElement('div');
      body.className = 'post-body';
      card.appendChild(body);
      if (p.platform === 'x') {
        var bq = document.createElement('blockquote');
        bq.className = 'twitter-tweet';
        bq.setAttribute('data-dnt', 'true');
        bq.setAttribute('data-theme', isDark() ? 'dark' : 'light');
        var a = document.createElement('a');
        a.href = p.url;
        a.textContent = 'View post on X';
        bq.appendChild(a);
        body.appendChild(bq);
      } else {
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.linkedin.com/embed/feed/update/' + p.urn + '?collapsed=1';
        iframe.title = 'LinkedIn post';
        iframe.loading = 'lazy';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '');
        body.appendChild(iframe);
      }
      strip.appendChild(card);
      if (p.platform === 'x') {
        // Size the embed to the card (X clamps to 250–550px).
        var w = Math.max(250, Math.min(550, body.clientWidth - 2));
        body.firstChild.setAttribute('data-width', String(w));
      }
    });
    if (window.twttr && twttr.widgets) twttr.widgets.load(strip);
  }

  function loadWidgets() {
    if (!posts.some(function (p) { return p.platform === 'x'; })) return;
    if (window.twttr) return;
    var s = document.createElement('script');
    s.src = 'https://platform.twitter.com/widgets.js';
    s.async = true;
    s.charset = 'utf-8';
    s.onload = function () { if (window.twttr && twttr.widgets) twttr.widgets.load(strip); };
    document.head.appendChild(s);
  }

  // Re-render X embeds when the theme toggle flips, so they follow dark / light mode.
  if (window.MutationObserver) {
    var themeTimer = null;
    new MutationObserver(function () {
      clearTimeout(themeTimer);
      themeTimer = setTimeout(render, 150);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Arrow buttons scroll the strip by one card.
  Array.prototype.forEach.call(document.querySelectorAll('.posts-arrow'), function (btn) {
    btn.addEventListener('click', function () {
      var card = strip.querySelector('.post-card');
      var step = card ? card.getBoundingClientRect().width + 16 : strip.clientWidth;
      strip.scrollBy({ left: step * Number(btn.getAttribute('data-dir')), behavior: 'smooth' });
    });
  });

  fetch('posts.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      var seen = {};
      posts = (Array.isArray(list) ? list : [])
        .map(function (item) {
          var entry = typeof item === 'string' ? { url: item } : (item || {});
          var p = typeof entry.url === 'string' ? parsePost(entry.url.trim()) : null;
          if (p) { p.pin = !!entry.pin; p.repost = !!entry.repost; }
          return p;
        })
        .filter(function (p) { return p && !seen[p.platform + p.id] && (seen[p.platform + p.id] = true); })
        .sort(function (a, b) { return (b.pin - a.pin) || (b.time - a.time); })
        .slice(0, MAX_POSTS);
      if (!posts.length) {
        if (empty) empty.hidden = false;
        var nav = document.querySelector('.posts-nav');
        if (nav) nav.hidden = true;
        return;
      }
      render();
      loadWidgets();
    })
    .catch(function () { if (empty) empty.hidden = false; });
})();
