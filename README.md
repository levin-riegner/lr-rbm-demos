# lr-rbm-demos

A collection of demo web apps for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs).

Each app is a small, self-contained web project designed for the 600x600 display and D-pad navigation. Built by [Levin Riegner](https://levinriegner.com) to explore what's possible on the glasses.

Each app is deployed on [Netlify](https://www.netlify.com/) and can be opened directly in the browser—no local setup required. The demos live at `https://rbm-demos.lnr.io/<app-name>/`; for example, [Calculator](https://rbm-demos.lnr.io/calculator/) is at `https://rbm-demos.lnr.io/calculator/`. Swap `calculator` for the folder name of the app you want to try.

## Running an app locally

```bash
cd <app-name>
python3 -m http.server 8080
```

Open `http://localhost:8080` in Chrome, set the viewport to 600x600 via DevTools, and navigate with arrow keys.

## License

MIT — see [LICENSE](LICENSE).
