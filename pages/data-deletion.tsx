import { PolicyPage } from '../components/marketing/PolicyPage';

export default function DataDeletion() {
  return (
    <PolicyPage title="Data Deletion" description="How merchants and customers can request deletion of information processed by UnieConnect.">
      <section><h2>Disconnect Shopify</h2><p>Uninstalling UnieConnect from Shopify revokes the store access token. Shopify&apos;s verified compliance notifications initiate the required customer or shop redaction workflow in UnieConnect.</p></section>
      <section><h2>Request deletion directly</h2><p>Email <a href="mailto:support@unielogics.com?subject=UnieConnect%20data%20deletion%20request">support@unielogics.com</a> from the account owner&apos;s email. Include the UnieConnect account email, Shopify store domain, and whether the request concerns an individual customer or the entire account.</p></section>
      <section><h2>Verification and timing</h2><p>We verify authority before deleting account information. Verified privacy requests are processed within the period required by applicable law and Shopify&apos;s requirements. Information may be retained when required for legal, security, fraud-prevention, or financial-record obligations.</p></section>
      <section><h2>What deletion changes</h2><p>Deleting a Shopify connection removes its stored credentials and Shopify-scoped mappings and operational records. Deleting an entire UnieConnect account removes account-scoped data that is not subject to a required retention period.</p></section>
    </PolicyPage>
  );
}
