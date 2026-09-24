import { Link } from 'react-router';

export function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-4 text-stone-700 [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-stone-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <h1 className="text-2xl font-semibold text-stone-900 lg:text-3xl">Privacy policy</h1>
      <p>
        Cart Wise helps you compare grocery prices. We collect as little personal information as we
        can, in line with the Protection of Personal Information Act (POPIA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, email address and a securely hashed password, to run your account.</li>
        <li>
          Your province, budget and savings threshold, to tailor price comparisons. Your province is
          the most precise location we store.
        </li>
        <li>
          Which loyalty programmes you use (for example Xtra Savings), so we only show member prices
          you can get. We never ask for card numbers.
        </li>
        <li>The stores you shop at, and your shopping lists.</li>
        <li>
          For each signed-in session, the IP address and browser type, to keep your account secure.
          Sessions are deleted when you sign out or they expire.
        </li>
      </ul>

      <h2>Prices and stores you add</h2>
      <p>
        Prices, products and stores you add are shared with everyone, so they help other shoppers.
        If you delete your account they stay in the app, but nothing links them to you anymore.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell or share your personal information.</li>
        <li>We don&apos;t use advertising or third-party tracking.</li>
        <li>We don&apos;t track your exact location.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can see and change your details in{' '}
        <Link to="/settings" className="underline">
          settings
        </Link>
        . You can delete your account there at any time; this permanently removes your personal
        information, preferences, stores and lists.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your information:{' '}
        <a
          href="https://github.com/d-langelihlekhumalo/cart-wise/issues"
          className="underline"
          rel="noreferrer"
          target="_blank"
        >
          open an issue on GitHub
        </a>
        .
      </p>
    </article>
  );
}

export function NotFoundPage() {
  return (
    <div className="space-y-2 pt-12 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="font-medium text-brand-700 underline">
        Go home
      </Link>
    </div>
  );
}
