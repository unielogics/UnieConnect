import { PolicyPage } from '../components/marketing/PolicyPage';

export default function Privacy() {
  return (
    <PolicyPage title="Privacy Policy" description="How UnieConnect collects, uses, protects, and deletes account and commerce data.">
      <section><h2>Information we process</h2><p>UnieConnect processes account contact information, authentication records, support communications, and operational data supplied by you or retrieved from services you connect. Connected Shopify data can include products, inventory, orders, fulfillment records, and customer information authorized by the scopes approved during installation.</p></section>
      <section><h2>How information is used</h2><p>We use this information to provide order, inventory, fulfillment, warehouse, reporting, audit, and Cortex intelligence workflows; maintain integrations; secure the service; diagnose failures; and provide support. We do not sell merchant or customer personal information.</p></section>
      <section><h2>Service providers and connected systems</h2><p>Information is shared only with infrastructure providers and connected systems needed to operate requested workflows, such as cloud hosting, authorized marketplaces, carriers, and warehouses. Each connection is scoped to the UnieConnect account that authorized it.</p></section>
      <section><h2>Security and retention</h2><p>We use access controls, encrypted transport, account isolation, audit records, and restricted production access. Operational information is retained while needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. Shopify privacy requests and verified deletion requests are processed according to applicable requirements.</p></section>
      <section><h2>Your choices and rights</h2><p>You can disconnect providers, correct account information, or request access to or deletion of personal information. Some records may be retained where legally required.</p></section>
      <section><h2>Contact</h2><p>Privacy and data requests can be sent to <a href="mailto:support@unielogics.com">support@unielogics.com</a>. Include the UnieConnect account email and affected Shopify store domain.</p></section>
    </PolicyPage>
  );
}
