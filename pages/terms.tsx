import { PolicyPage } from '../components/marketing/PolicyPage';

export default function Terms() {
  return (
    <PolicyPage title="Terms of Service" description="Terms governing access to and use of the UnieConnect platform.">
      <section><h2>Service</h2><p>UnieConnect provides commerce operations, marketplace connectivity, inventory, fulfillment, warehouse, reporting, audit, and assisted intelligence tools. Feature availability depends on your plan, connected providers, permissions, and available data.</p></section>
      <section><h2>Your account</h2><p>You are responsible for authorized account access, accurate information, connected-system permissions, and activity performed through your account. You must have authority to connect each marketplace, warehouse, carrier, or other provider.</p></section>
      <section><h2>Operational decisions</h2><p>Recommendations, estimates, forecasts, and optimized scenarios are decision-support outputs. Review material actions before approval. Provider acceptance, rates, delivery performance, marketplace eligibility, and financial outcomes are not guaranteed.</p></section>
      <section><h2>Acceptable use</h2><p>You may not use the service to violate law, access data without authorization, interfere with platform security, or transmit malicious content. We may limit access needed to protect accounts, connected systems, or the service.</p></section>
      <section><h2>Third-party services</h2><p>Connected services are governed by their own agreements. UnieConnect is not responsible for an external provider&apos;s availability, policy changes, or independent processing outside UnieConnect.</p></section>
      <section><h2>Contact</h2><p>Questions about these terms can be sent to <a href="mailto:support@unielogics.com">support@unielogics.com</a>.</p></section>
    </PolicyPage>
  );
}
