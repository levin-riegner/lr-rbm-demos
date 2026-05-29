---
name: rbm-demo-favicon
description: Add a favicon to a Meta Ray-Ban Display demo app in lr-rbm-demos. Use when the user asks to add a favicon to a web app.
---

# RBM demo favicon

Add a favicon to a demo folder (`<app-name>/` with `index.html`).

- Favicon file lives in the app root, named `favicon.png` (preferred size 512×512).
- Add this line to `index.html`, right after `<title>`:

```html
  <link rel="icon" type="image/png" href="favicon.png">
```

That's it. Don't touch the top-level `README.md` for favicon-only changes.
