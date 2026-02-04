export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-gray-600 mb-4">Last updated: February 2026</p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
          <p className="text-gray-700">
            Poppin (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Poppin app and Pia AI assistant.
            This Privacy Policy explains how we collect, use, and protect your information when you
            use our services, including interactions with our Instagram account @pia.chicago.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
          <p className="text-gray-700 mb-2">When you interact with Pia via Instagram DMs, we may collect:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Your Instagram username and user ID</li>
            <li>Messages you send to our Instagram account</li>
            <li>Your general location (if you share it in messages)</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
          <p className="text-gray-700 mb-2">We use the information collected to:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Respond to your inquiries about Chicago nightlife and venues</li>
            <li>Provide personalized venue recommendations</li>
            <li>Improve our AI assistant&apos;s responses</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
          <p className="text-gray-700">
            We do not sell your personal information. We may share data with service providers
            (such as Meta/Instagram for messaging and Anthropic for AI processing) solely to
            provide our services.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
          <p className="text-gray-700">
            We retain message data only as long as necessary to provide our services.
            Conversation history is not permanently stored.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
          <p className="text-gray-700">
            You may request deletion of your data by contacting us. You can also stop
            interacting with our Instagram account at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">7. Contact Us</h2>
          <p className="text-gray-700">
            For privacy-related questions, contact us at: privacy@poppin.app
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
          <p className="text-gray-700">
            We may update this Privacy Policy from time to time. We will notify users of
            significant changes through our app or Instagram.
          </p>
        </section>
      </div>
    </div>
  );
}
