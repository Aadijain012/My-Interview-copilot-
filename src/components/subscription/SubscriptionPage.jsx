import React from 'react';
import PricingPage from '../../pricing/PricingPage';

export default function SubscriptionPage({ onBack, onNavigate, darkMode, toggleDarkMode, token, user, ...rest }) {
  return (
    <PricingPage
      onBack={onBack}
      onNavigate={onNavigate}
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
      token={token}
      user={user}
      {...rest}
    />
  );
}
