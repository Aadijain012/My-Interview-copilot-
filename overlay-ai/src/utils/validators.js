const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com',
  'guerrillamail.com', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'dispostable.com', 'getairmail.com', 'trashmail.com', 'fakemailgenerator.com',
  'fakeinbox.com', 'sample.com', 'fakemail.net', 'tempmail.net', 'burnermail.io',
  'crazymailing.com', 'mytemp.email', 'tempmailaddress.com'
]);

function validateEmailAddress(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  const [localPart, domain] = cleanEmail.split('@');
  if (!localPart || !domain) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, error: 'Please enter an email with a valid domain extension (e.g. .com).' };
  }
  if (localPart.length < 2) {
    return { valid: false, error: 'Email prefix must be at least 2 characters long.' };
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable and temporary email addresses are not permitted.' };
  }
  return { valid: true, cleanEmail };
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  return { valid: true };
}

module.exports = {
  validateEmailAddress,
  validatePasswordStrength
};
