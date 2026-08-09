/**
 * Team emails workspace — compose a broadcast, and the history of past ones.
 *
 * Owner/Admin only, gated in three places like every sensitive surface here:
 * the route guard (UX), `authorize()` in the server function against real
 * `user_roles` grants (the real gate), and RLS on `general_emails` /
 * `general_email_deliveries` (the backstop).
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BroadcastHistory } from "./broadcast-history";
import { ComposeBroadcast } from "./compose-broadcast";

export function BroadcastPanel() {
  return (
    <Tabs defaultValue="compose">
      <TabsList>
        <TabsTrigger value="compose">Compose</TabsTrigger>
        <TabsTrigger value="history">Sent messages</TabsTrigger>
      </TabsList>

      <TabsContent value="compose">
        <ComposeBroadcast />
      </TabsContent>

      <TabsContent value="history">
        <BroadcastHistory />
      </TabsContent>
    </Tabs>
  );
}
