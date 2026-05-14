# Crypto Tracker - Meta Display Glasses WebApp

Live USD prices and 24h change for 8 major cryptocurrencies, powered by the free **CoinGecko** API (no API key).

## How to run (Chrome)

```bash
cd examples/crypto-tracker
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in Chrome, then:

1. Press **Cmd+Shift+M** to toggle the device toolbar
2. Set a **custom viewport of 600 x 600**
3. Refresh the page

## Controls

- **Arrow keys** - move focus (D-pad)
- **Enter** - activate / open detail (EMG pinch)
- **Escape** - back

## Screens

- **Home** - 8-coin list with price + 24h change badge + favorite star; tabs for **All** / **Favorites**
- **Detail** - symbol, name, large price, change badge, and stat grid (Price, 24h Change, Last Updated); toggle favorite

## API

Single call: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano,polkadot,chainlink,avalanche-2,matic-network&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`

- Auto-refresh every **30s** while on the Home screen (paused on Detail or when tab is hidden)
- Response cached in memory and `localStorage` (`mdg_crypto_tracker`); network only hit when cache is >30s old
- Favorites persisted in `localStorage` (`mdg_crypto_tracker_favs`)

## Files

```
crypto-tracker/
  index.html   # Home + Detail screens
  styles.css   # dark theme, coin card, change badge, skeleton, tabs
  app.js       # fetch + cache + render, auto-refresh, favorites, D-pad
  vercel.json  # static rewrites
```
