# Meta Ray-Ban Display Glasses demos by L+R

A collection of demo web apps for the [Meta Ray-Ban Display glasses](https://wearables.developer.meta.com/docs).

Each app is a small, self-contained web project designed for the 600x600 display and D-pad navigation. Built by [L+R](https://levinriegner.com) to explore what's possible on the glasses.

## Demos GIFs

<img width="200" height="200" alt="weather" src="https://github.com/user-attachments/assets/7a2298b7-244b-43bb-ae75-5a6ee7c626ca" />
<img width="200" height="200" alt="pomodoro" src="https://github.com/user-attachments/assets/7f5f6998-f493-41c4-a8fb-ffbecd758fb9" />
<img width="200" height="200" alt="metronome" src="https://github.com/user-attachments/assets/9629936c-77a2-4fd5-9e9f-91ed15f25b53" />
<img width="200" height="200" alt="flight-status" src="https://github.com/user-attachments/assets/adebccd0-a995-488e-a482-10ceec05684e" />
<img width="200" height="200" alt="demo-pair-hud" src="https://github.com/user-attachments/assets/b8f02f1f-b9f6-43ed-9f49-0b406f98dad6" />
<img width="200" height="200" alt="dad-jokes" src="https://github.com/user-attachments/assets/99a8a164-9e88-4f75-bc62-67d3b7ded329" />
<img width="200" height="200" alt="crypto-tracker" src="https://github.com/user-attachments/assets/cef49fcf-c9b4-47e3-9946-19950bf79f64" />
<img width="200" height="200" alt="calculator" src="https://github.com/user-attachments/assets/cf1f56b3-3dc5-4a7d-b985-b762bae87258" />

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

## Simulator

A browser-based simulator that previews how any web app would look on the display glasses. It applies the additive waveguide blend (plus-lighter) over a real-world background image, so you can judge contrast and legibility without a physical device.

Try it live: [https://rbm-demos.lnr.io/simulator/](https://rbm-demos.lnr.io/simulator/)

Features:
- Load any URL into the simulated 600x600 HUD
- Drag to reposition, resize the display
- Swap background scenes or upload your own image/video
- Adjust HUD brightness, size, and background brightness
- Press **H** to hide all UI overlays for clean screen recordings

## Running an app locally

```bash
cd <app-name>
python3 -m http.server 8080
```

Open `http://localhost:8080` in Chrome, set the viewport to 600x600 via DevTools, and navigate with arrow keys.

## License

MIT — see [LICENSE](LICENSE).
