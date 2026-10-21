import Link from 'next/link';
import { PolicyPage } from '../components/marketing/PolicyPage';

export default function Support() {
  return (
    <PolicyPage title="Support" description="Get help with UnieConnect accounts, Shopify connections, synchronization, and operations.">
      <section><h2>Contact support</h2><p>Email <a href="mailto:support@unielogics.com">support@unielogics.com</a>. Include your account email, Shopify store domain, the affected screen, and the approximate time of the issue. Do not send passwords, client secrets, or access tokens.</p></section>
      <section><h2>Connection support</h2><p>For Shopify installation or synchronization issues, include whether the issue occurred during authorization, initial synchronization, webhook delivery, or a manual refresh. UnieConnect support can inspect account-scoped provider evidence without requesting your Shopify password.</p></section>
      <section><h2>Privacy and deletion</h2><p>See the <Link href="/data-deletion">Data Deletion page</Link> for removal requests and the <Link href="/privacy">Privacy Policy</Link> for how information is processed.</p></section>
    </PolicyPage>
  );
}
