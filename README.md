# QR Creator

A browser-based QR code generator with custom branding — add your logo, choose colors, auto-download, and create dynamic QR codes.

## Features

- **Text / URL input** – generate QR codes from any content
- **Custom colors** – pick foreground and background colors
- **Logo overlay** – upload your own logo and control its size (10–40%)
- **Error correction** – Low, Medium, Quartile, High
- **Size options** – 200px up to 600px
- **Margin control** – 0–4 module quiet zone
- **Download formats** – PNG, JPEG, and SVG
- **Auto-download** – automatically save after generation (toggle on/off)
- **Dynamic QR codes** – generate QR codes that point to a redirect URL you can update anytime without reprinting
- **Management dashboard** – view, edit destinations, and delete your dynamic QR codes
- **Scan tracking** – each dynamic QR code tracks scan count

## Usage

### Static QR codes
Open `index.html` in any browser — no build step required.

### Dynamic QR codes
Dynamic QR codes require a backend (Vercel with KV store).

1. **Deploy to Vercel:**
   ```bash
   npx vercel
   ```

2. **Set up Vercel KV:**
   - Go to your Vercel dashboard → Storage → Create KV database
   - Link it to your project (the environment variables are added automatically)

3. **Create dynamic QR codes:**
   - Select "Dynamic QR Code" in the sidebar
   - Enter your destination URL and a management key
   - Generate — the QR code will point to a URL on your domain
   - Change the destination anytime from the management panel

### Local development
```bash
npm install
npx vercel dev
```

## Deployment

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new)

After deploying, create a KV database in your Vercel dashboard and link it to your project.

## Tech

- Vanilla JS (no framework)
- [qrcode](https://www.npmjs.com/package/qrcode) – QR generation
- Canvas API – logo overlay
- Vercel KV – dynamic QR storage
- Vercel Functions – redirect API

## License

MIT © Thando Hlomuka
