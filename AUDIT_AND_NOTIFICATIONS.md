# Audit & Notifications System

## 📊 Audit Logs Page Location

**URL:** `/admin/audit`  
**Access:** Admin & Manager roles  
**Permission:** `audit.view` (also requires `audit.export`)

### Features

✅ **Immutable Activity Trail** - All auditable actions are permanently logged with timestamps  
✅ **User Attribution** - Each log entry shows who performed the action  
✅ **Detailed State Tracking** - Captures "before" and "after" data for changes  
✅ **IP Address & Device Logging** - Records source device and IP address  
✅ **Advanced Filtering** - Filter by action, resource type, user, or date range  
✅ **Event Detail Inspector** - Click any log to see full details including state changes  
✅ **Pagination** - Supports 20 records per page with total count

### Audit Log Columns

| Column | Description |
|--------|-------------|
| **Timestamp** | When the action occurred (date + time) |
| **User** | Who performed the action (name + email, or "System") |
| **Event Action** | What happened (e.g., `user.created`, `auth.login`, `settings.updated`) |
| **Target Entity** | What was affected (resource type + ID) |
| **IP Address** | Source IP address of the request |
| **Actions** | Click eye icon to inspect full event details |

### Event Detail Modal

When you click the eye icon on any audit log, you see:
- **Event ID** - Unique audit log identifier
- **Action** - Exact action code
- **Resource Type** - What entity was affected
- **Resource ID** - ID of the affected entity
- **IP Address** - Source IP
- **Timestamp** - Full timestamp
- **User Info** - Actor's name and email
- **State Before** - Previous data (JSON) for updates
- **State After** - New data (JSON) for updates

## 🎯 What's Currently Being Audited

### ✅ Fully Audited

**Authentication & Security:**
- User login attempts (success & failure)
- Failed login attempts (throttled at 50/15min)
- Failed 2FA attempts
- Successful 2FA setup
- Password change attempts (success & failure)
- Token refresh operations
- Session creation/management

**User Management:**
- User account creation (captured full user data)
- User updates (captured before & after state)
- Account deactivation/suspension (captured status change)
- Role assignments (tracked role changes)
- Permission changes (tracked permission grants/revokes)

**System Configuration:**
- Settings/preferences updates (captured key & value changes)
- Configuration changes (before & after captured)
- System-wide changes

### ⏳ NOT YET Audited (Priority for Next Phase)

**High Priority (Financial Impact):**
- ❌ Payment processing (create, modify, refund)
- ❌ Expense recording/approval
- ❌ Folio/invoice generation
- ❌ Room rate changes
- ❌ Pricing adjustments

**Medium Priority (Operational):**
- ❌ Reservation creation/cancellation
- ❌ Room status changes
- ❌ Guest check-in/check-out
- ❌ Inventory adjustments
- ❌ Menu item changes
- ❌ Event space operations
- ❌ POS transactions

**Lower Priority:**
- ❌ Report generation/export
- ❌ Data imports
- ❌ System health checks

## 🔔 Notifications System

### Current Status: **Partial Implementation**

#### ✅ Toast Notifications (Working)

Toast notifications display temporary messages in the bottom-right corner of the app:
- **Auto-dismiss:** 4 seconds
- **Types:** Success (green), Error (red), Warning (orange), Info (blue)
- **Deduplication:** Identical messages only shown once
- **Manual close:** Click the X to dismiss immediately
- **Location:** Bottom-right corner, fixed position

**Usage in Code:**
```typescript
import { showToast } from '../../components/ui';

showToast('success', 'Event space deleted.');
showToast('error', 'Failed to load staff directory.');
showToast('warning', 'Low inventory warning');
showToast('info', 'Payment processed');
```

#### ❌ Persistent Notifications (Not Yet Implemented)

The following notification features are configured but not yet implemented:

**Settings Available:**
- Email notifications enabled/disabled
- SMS notifications enabled/disabled
- Reservation confirmation emails
- Payment receipt emails
- Daily report emails
- Low inventory alert threshold
- Notification priority levels (defined enum)

**What's Missing:**
- No Notification database model
- No notification service implementation
- No notification API routes
- No real-time notification system (WebSockets)
- No notification UI/inbox
- No email/SMS delivery service

### Notification Bell Icon

The notification bell in the header is currently **disabled** (shows "coming soon" tooltip). When persistent notifications are implemented, it will:
- Show unread notification count badge
- Open a notification inbox
- Support mark-as-read functionality
- Filter by notification type

## 🔒 Security & Compliance

### Audit Log Protection

- **Immutable:** Audit logs cannot be modified or deleted
- **Indexed:** Optimized queries on user_id, action, resource, created_at
- **Retention:** Configurable retention (default: 365 days)
- **Access Control:** Only users with `audit.view` permission can read logs

### User Privacy

- Passwords are hashed and not stored in audit logs
- Sensitive data (SSN, card numbers) should not be logged
- Personal information in audit logs is limited to name/email

## 📈 Audit Analytics (Admin Console Dashboard)

The Admin Console includes a preview of the 8 most recent audit events with:
- Action type badge
- Resource affected
- Actor (user name/email)
- IP address
- Timestamp
- Click "Full audit logs →" to see all records

## 🔧 Troubleshooting

### Audit Logs Not Showing

1. **Check permissions:** User must have `audit.view` permission
2. **Check roles:** Only Admin and Manager roles have audit.view
3. **Database:** Ensure audit logs table is not empty (run seed if needed)
4. **Filters:** Clear all filters and refresh

### Missing Audit Events

- **Not logged yet:** Payments, reservations, rooms, inventory, POS (backlog)
- **System events only:** Some operations log with userId=null
- **Search:** Use the action filter to find specific events

## 🚀 Roadmap

### Phase 2: Financial Auditing
- [ ] Log all payment operations
- [ ] Log all expense operations
- [ ] Capture financial state changes
- [ ] Generate financial audit reports
- [ ] Export audit trail for external audit

### Phase 3: Operational Auditing
- [ ] Log reservations & check-in/out
- [ ] Log room status changes
- [ ] Log inventory changes
- [ ] Log POS transactions
- [ ] Generate operational reports

### Phase 4: Real-time Notifications
- [ ] Implement persistent notification storage
- [ ] Add notification inbox UI
- [ ] WebSocket real-time delivery
- [ ] Email notification delivery
- [ ] SMS notification delivery (optional)
- [ ] Notification preferences per user

## 📞 Support

**Questions about audit logs?**
- Check the audit logs page help (click the ? icon)
- Review this documentation
- Check specific audit events in the detail view

**Notification feature status?**
- Toast notifications are working (bottom-right)
- Persistent notifications coming in next phase
- Email/SMS coming after persistent notifications implemented
