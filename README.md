# Byenext — working starter

## Run locally
1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run `npm install`
4. Run `npm start`
5. Open http://localhost:3000

Demo admin:
- Email: admin@byenext.com
- Password: Admin@123

This starter includes customer signup/login, product catalog, cart, order creation, 1% service-fee calculation, order tracking, SQLite database, and an admin panel.

### Production notes
- Change `JWT_SECRET` and the demo admin password.
- Add a real payment gateway before accepting payments.
- Add server-side validation, rate limiting, HTTPS, secure cookies, CSRF protection, image storage, inventory reconciliation, refunds/returns, and audit logs.
- Do not automate purchases from Flipkart unless you have an authorized integration and comply with Flipkart's applicable terms and policies.
