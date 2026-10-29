# rootyJeon.github.io

Personal homepage (static `index.html`, served by GitHub Pages).

## Recent Posts section

`posts.json` is a plain list of post URLs from X and LinkedIn. The page renders each one
as an official embed and sorts them newest-first automatically (the post ID encodes the date),
so just add a link and push:

```bash
python3 scripts/add_post.py "https://x.com/rootyjeon/status/<id>"
python3 scripts/add_post.py --repost "https://x.com/<someone>/status/<id>"   # shows "Reposted by me"
python3 scripts/add_post.py --pin "https://x.com/rootyjeon/status/<id>"      # always first
```

An entry in `posts.json` is either a URL string or `{"url": "...", "repost": true, "pin": true}`.

Or, from any device: GitHub → **Actions** → **Add post** → *Run workflow* → paste the URL.
The workflow commits the change for you.

Accepted URL shapes:

- X: `https://x.com/<user>/status/<id>` (for a repost, use the original post's URL)
- LinkedIn: `https://www.linkedin.com/posts/<slug>-share-<id>-xxxx` or `...-activity-<id>-xxxx` (the "Copy link to post" URL;
  `lnkd.in` short links must be expanded first),
  or the `urn:li:share:` / `urn:li:ugcPost:` URL from LinkedIn's "Embed this post" menu
