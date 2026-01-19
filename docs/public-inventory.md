# Public Inventory

This document summarizes the current `public/` deployment tree, main entry points, and AWS/API touchpoints. Use this as a cleanup guide before deleting or moving files.

## Deployment Assumption
- `public/` is the served directory.
- `src/` is no longer tracked in Git.
- Corporate/customer split uses `/corporate/` and `/customer/` under `public/`.
- Legacy URLs remain as redirect stubs to preserve links.

## Top-Level Areas (public/)
- Corporate site: `public/corporate/` (was root marketing pages).
- Customer site: `public/customer/` (was mypage/auth/order related pages).
- Admin dashboard: `public/admin/`.
- Sales dashboard: `public/sales/`.
- Staff portal: `public/staff/`.
- Shared assets: `public/css/`, `public/js/`, `public/images*/`, `public/data/`.
- Static campaign: `public/202512camp/`.
- Legal pages: `public/規約/`.

## Corporate Site (public/corporate/)
Typical routes moved here (both `*.html` and `*/index.html` kept, with old paths redirecting):
- `/index.html`
- `/about*`, `/service*`, `/lp*`, `/announcements*`, `/contact*`
- `/partner*`, `/voice*`, `/recruit*`, `/greeting*`
- `/privacy-policy*`, `/security-policy*`, `/service-terms*`, `/tokushoho*`, `/workplace-policy*`
- `/customers*`, `/customers-support-desk*`
- `/bulletin-board*`, `/antisocial-declaration*`, `/teikiseisou*`, `/concierge.html`
- `/202512camp/*`

## Customer Site (public/customer/)
Typical routes moved here (both `*.html` and `*/index.html` kept, with old paths redirecting):
- `/signin*`, `/signup*`, `/signup2*`, `/signup3*`
- `/mypage*`, `/registration*`
- `/order*`, `/cart*`, `/checkout*`
- `/reset-password*`, `/report*`, `/reports*`, `/schedule*`

## Staff Portal (public/staff/)
### Sign-in routing
- `public/staff/signin.html`, `public/staff/signin/index.html`
- Redirects by department:
  - OS: `/staff/os/mypage`
  - Sales: `/staff/sales/mypage`
  - Office: `/staff/office/mypage`

### OS department
- Mypage: `public/staff/os/mypage.html`, `public/staff/os/mypage/index.html`
- Schedule: `public/staff/os/schedule.html`, `public/staff/os/schedule/index.html`
- Reports list: `public/staff/os/reports.html`, `public/staff/os/reports/index.html`
- Report new: `public/staff/os/reports/new.html`, `public/staff/os/reports/new/index.html`
- Media: `public/staff/os/media.html`, `public/staff/os/media/index.html`

### Non-OS staff (legacy pages still present)
- Mypage: `public/staff/mypage.html`, `public/staff/mypage/index.html`
- Schedule: `public/staff/schedule.html`, `public/staff/schedule/index.html`
- Reports: `public/staff/reports.html`, `public/staff/reports/index.html`
- Report new: `public/staff/reports/new.html`, `public/staff/reports/new/index.html`
- Media: `public/staff/media.html`, `public/staff/media/index.html`
- Attendance history: `public/staff/attendance-history.html`, `public/staff/attendance-history/index.html`
- Daily reports: `public/staff/daily-reports.html`, `public/staff/daily-reports/index.html`
- Work history/list: `public/staff/work-history.html`, `public/staff/work-history/index.html`, `public/staff/work-list.html`, `public/staff/work-list/index.html`
- Training: `public/staff/training.html`, `public/staff/training/index.html`
- NFC clock-in: `public/staff/nfc-clock-in.html`, `public/staff/nfc-clock-in/index.html`
- Announcements: `public/staff/announcements.html`, `public/staff/announcements/index.html`
- Inventory scan: `public/staff/inventory/scan.html`, `public/staff/inventory/scan/index.html`

### Sales/Office department pages
- Sales mypage: `public/staff/sales/mypage.html`, `public/staff/sales/mypage/index.html`
- Office mypage: `public/staff/office/mypage.html`, `public/staff/office/mypage/index.html`

### Unlinked candidate
- `public/staff/mypageのコピー.html` (no references found)

### Staff documentation
- Cleaning manual: `public/staff/cleaning-manual/` + `public/staff/cleaning-manual.html`
- Cleaning manual admin: `public/staff/cleaning-manual-admin/` + `public/staff/cleaning-manual-admin.html`
- Wiki: `public/staff/wiki/`

## Admin Dashboard (public/admin/)
Key areas:
- Dashboard: `public/admin/dashboard/`
- Schedules: `public/admin/schedules/`
- Reports: `public/admin/reports/`
- Users: `public/admin/users/`
- Attendance: `public/admin/attendance/`
- Customers/Stores/Brands: `public/admin/customers/`
- Media: `public/admin/images/`

## Sales Dashboard (public/sales/)
- Dashboard: `public/sales/dashboard/`
- Clients: `public/sales/clients/`
- Schedules: `public/sales/schedules/`
- Estimates/Orders: `public/sales/estimates/`, `public/sales/orders/`

## Public/Marketing
Representative routes moved to corporate/customer splits:
- Corporate: `/corporate/*`
- Customer: `/customer/*`

## Shared Assets
- CSS: `public/css/*.css`
- JS: `public/js/*.js`
- Data: `public/data/*.json`
- Images: `public/images*`, `public/images-admin`, `public/images-service`, etc.

## AWS/API Endpoints (found in public HTML/JS)
- `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod`
- `https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod`
- `https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod` (placeholder in `public/js/aws-s3-upload.js`)

## Auth/Cognito Touchpoints
- Cognito auth helpers: `public/js/cognito_auth.js`, `public/js/cognito_config.js`, `public/js/client_auth.js`.
- Many staff/admin pages read tokens from localStorage: `cognito_id_token`, `cognito_access_token`, `cognito_refresh_token`, `cognito_user`.

## Cleanup Notes
- Many pages exist as both `path.html` and `path/index.html`. Keep both unless routing is confirmed.
- Remove or consolidate only after link/JS references are verified.
