-- Consolidate legacy outlet roles into the one official F&B role.
-- Uses fixed text IDs because the schema owns UUID generation in Prisma, not SQL.
INSERT INTO "roles" ("id", "name", "description", "is_system", "created_at")
VALUES ('nslv-system-role-fnb', 'F&B', 'Restaurant, bar and pool operations', true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "is_system" = true;

-- Preserve every existing outlet user by assigning F&B before the old roles are removed.
INSERT INTO "user_roles" ("user_id", "role_id", "assigned_at")
SELECT DISTINCT ur."user_id", fnb."id", CURRENT_TIMESTAMP
FROM "user_roles" ur
JOIN "roles" legacy ON legacy."id" = ur."role_id"
JOIN "roles" fnb ON fnb."name" = 'F&B'
WHERE legacy."name" IN ('Restaurant', 'Bar', 'Pool')
ON CONFLICT ("user_id", "role_id") DO NOTHING;

-- Retain the union of outlet capabilities until the normal seed synchronises
-- the complete F&B permission set on the deployment.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT fnb."id", rp."permission_id"
FROM "role_permissions" rp
JOIN "roles" legacy ON legacy."id" = rp."role_id"
JOIN "roles" fnb ON fnb."name" = 'F&B'
WHERE legacy."name" IN ('Restaurant', 'Bar', 'Pool')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

DELETE FROM "roles" WHERE "name" IN ('Restaurant', 'Bar', 'Pool');

-- The official role names are immutable system roles.
UPDATE "roles" SET "is_system" = true WHERE "name" IN ('Admin', 'Manager', 'Reception', 'F&B');
