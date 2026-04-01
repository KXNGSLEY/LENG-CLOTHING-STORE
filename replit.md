# LENG Clothing Store

## Project Overview
A futuristic/cyberpunk-themed e-commerce clothing store built as a monolithic Node.js application.

## Architecture
- **Type**: Monolithic Node.js/Express server-side rendered web application
- **Language**: JavaScript (Node.js)
- **Framework**: Express.js
- **Database**: Google Cloud Datastore (via Firebase Admin SDK)
- **Image Hosting**: ImgBB API
- **Session Management**: express-session
- **File Uploads**: multer (memory storage)

## Project Structure
```
index.js                          # Main application file (server + all routes + HTML templates)
package.json                      # Node.js dependencies
prototype-v-1-firebase-adminsdk-*.json  # Firebase service account credentials
```

## Running the App
- **Port**: 5000 (binds to 0.0.0.0)
- **Command**: `node index.js`
- **Workflow**: "Start application"

## Key Routes
- `GET /` — Home page with Latest Drop
- `GET /store` — Product store listing
- `GET /product/:id` — Individual product page
- `GET /cart` — Shopping cart
- `GET /admin` — Admin dashboard for inventory management
- `POST /admin/add` — Add new product (with image upload to ImgBB)
- `POST /admin/delete/:id` — Delete product
- `POST /admin/soldout/:id` — Mark product as sold out

## External Services
- **Google Cloud Datastore**: Primary database for storing store items
- **Firebase Admin SDK**: Authentication/admin integration
- **ImgBB**: Image hosting for product photos (API key hardcoded in index.js)

## Frontend
- Pure HTML/CSS/JS rendered as template strings in Express routes
- Futuristic/cyberpunk aesthetic with neon green (#00ff50) on dark background
- Orbitron font (Google Fonts)
- Animated particle effects and shooting stars
- Shopping cart uses localStorage for client-side persistence

## Deployment
- Target: autoscale
- Run: `node index.js`
