@@ .. @@
 CREATE POLICY "Public can view business info for active shops"
   ON businesses
   FOR SELECT
   TO public
   USING (
-    id IN (
-      SELECT business_id FROM shops WHERE active = true
-    )
+    EXISTS (
+      SELECT 1 FROM shops WHERE shops.business_id = businesses.id AND shops.active = true
+    )
   );