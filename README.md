# lr-rbm-demos

A collection of demo web apps for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs).

Each app is a small, self-contained web project designed for the 600x600 display and D-pad navigation. Built by [Levin Riegner](https://levinriegner.com) to explore what's possible on the glasses.

Each app is deployed on [Netlify](https://www.netlify.com/) and can be opened directly in the browser—no local setup required. URLs follow `https://rbm-demos.lnr.io/<path>/` (use the project folder path under this repo).

## Hosted demos

- [Brusher](https://rbm-demos.lnr.io/brusher/)
- [Calculator](https://rbm-demos.lnr.io/calculator/)
- [Chores](https://rbm-demos.lnr.io/chores/)
- [Cooking HUD](https://rbm-demos.lnr.io/cooking-hud/)
- [Crypto Tracker](https://rbm-demos.lnr.io/crypto-tracker/)
- [Dad Jokes](https://rbm-demos.lnr.io/dad-jokes/)
- [Deep Link Launcher](https://rbm-demos.lnr.io/deep-link-launcher/)
- [Deep Link Target](https://rbm-demos.lnr.io/deep-link-target/)
- [Find My Car](https://rbm-demos.lnr.io/find-my-car/)
- [Flashcards (Serbian)](https://rbm-demos.lnr.io/flashcards-serbian/)
- [Flight Status](https://rbm-demos.lnr.io/flight-status/)
- [Glasses API Test](https://rbm-demos.lnr.io/glasses-api-test/)
- [Head Gesture Prototype](https://rbm-demos.lnr.io/head-gesture-prototype/)
- [Headprint](https://rbm-demos.lnr.io/headprint/)
- [IP Info](https://rbm-demos.lnr.io/ip-info/)
- [Kairos Calendar HUD](https://rbm-demos.lnr.io/kairos-calendar-hud/)
- [Key Logger](https://rbm-demos.lnr.io/key-logger/)
- [Levin Riegner](https://rbm-demos.lnr.io/levinriegner/)
- [LR Glimmer](https://rbm-demos.lnr.io/lr-glimmer/)
- [Meditation](https://rbm-demos.lnr.io/meditation/)
- [Metronome](https://rbm-demos.lnr.io/metronome/)
- [Pair HUD](https://rbm-demos.lnr.io/pair-hud/)
- [Periff](https://rbm-demos.lnr.io/periff/)
- [Pinout HUD](https://rbm-demos.lnr.io/pinout-hud/)
- [Plane Spotter](https://rbm-demos.lnr.io/plane-spotter/)
- [Pomodoro](https://rbm-demos.lnr.io/pomodoro/)
- [Pong](https://rbm-demos.lnr.io/pong/)
- [Recipe Stepper](https://rbm-demos.lnr.io/recipe-stepper/)
- [Snake](https://rbm-demos.lnr.io/snake/)
- [Speedometer](https://rbm-demos.lnr.io/speedometer/)
- [Spireworks](https://rbm-demos.lnr.io/spireworks/)
- [Tally Counter](https://rbm-demos.lnr.io/tally-counter/)
- [Teleprompter (admin)](https://rbm-demos.lnr.io/teleprompter/admin/)
- [Teleprompter (glasses)](https://rbm-demos.lnr.io/teleprompter/glasses/)
- [Tiltscroll Tales](https://rbm-demos.lnr.io/tiltscroll-tales/)
- [Trivia Live](https://rbm-demos.lnr.io/trivia-live/)
- [Weather Dashboard](https://rbm-demos.lnr.io/weather-dashboard/)
- [Zork Terminal](https://rbm-demos.lnr.io/zork-terminal/)

## Running an app locally

```bash
cd <app-name>
python3 -m http.server 8080
```

Open `http://localhost:8080` in Chrome, set the viewport to 600x600 via DevTools, and navigate with arrow keys.

## License

MIT — see [LICENSE](LICENSE).
