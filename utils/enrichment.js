/**
 * Auto-detects an HR's display name and company name purely from
 * their email address. Used to personalize outgoing letters when the
 * user only supplies a list of email addresses (e.g. via CSV/Excel
 * upload) without explicit name/company columns.
 */

// Local-parts that carry no personal-name signal (role inboxes).
const GENERIC_LOCALPARTS = new Set([
  'hr', 'jobs', 'career', 'careers', 'recruit', 'recruits', 'recruiting',
  'recruitment', 'talent', 'talentacquisition', 'ta', 'info', 'contact',
  'admin', 'administrator', 'support', 'noreply', 'no-reply', 'donotreply',
  'team', 'apply', 'application', 'applications', 'resume', 'resumes',
  'hiring', 'hiringteam', 'people', 'humanresources', 'people-ops',
  'peopleops', 'office', 'mail', 'enquiry', 'enquiries', 'jobsindia',
  'careersindia', 'staffing', 'placement', 'placements',
]);

// Well-known domain -> company display name lookups.
// Extend this map any time you notice a domain resolving incorrectly.
const KNOWN_DOMAIN_COMPANIES = {
  // Indian IT services
  'tcs.com': 'Tata Consultancy Services',
  'infosys.com': 'Infosys',
  'wipro.com': 'Wipro',
  'hcltech.com': 'HCLTech',
  'hcl.com': 'HCL Technologies',
  'techmahindra.com': 'Tech Mahindra',
  'ltimindtree.com': 'LTIMindtree',
  'mindtree.com': 'Mindtree',
  'ltts.com': 'L&T Technology Services',
  'larsentoubro.com': 'Larsen & Toubro',
  'capgemini.com': 'Capgemini',
  'cognizant.com': 'Cognizant',
  'mphasis.com': 'Mphasis',
  'persistent.com': 'Persistent Systems',
  'zensar.com': 'Zensar Technologies',
  'birlasoft.com': 'Birlasoft',
  'coforge.com': 'Coforge',
  'hexaware.com': 'Hexaware Technologies',

  // Global consulting / professional services
  'accenture.com': 'Accenture',
  'deloitte.com': 'Deloitte',
  'pwc.com': 'PwC',
  'kpmg.com': 'KPMG',
  'ey.com': 'EY',
  'mckinsey.com': 'McKinsey & Company',
  'bcg.com': 'Boston Consulting Group',
  'bain.com': 'Bain & Company',

  // Big tech
  'google.com': 'Google',
  'microsoft.com': 'Microsoft',
  'amazon.com': 'Amazon',
  'amazon.in': 'Amazon',
  'meta.com': 'Meta',
  'facebook.com': 'Meta',
  'apple.com': 'Apple',
  'netflix.com': 'Netflix',
  'ibm.com': 'IBM',
  'oracle.com': 'Oracle',
  'sap.com': 'SAP',
  'salesforce.com': 'Salesforce',
  'adobe.com': 'Adobe',
  'intel.com': 'Intel',
  'nvidia.com': 'NVIDIA',
  'dell.com': 'Dell',
  'hp.com': 'HP',
  'cisco.com': 'Cisco',
  'vmware.com': 'VMware',
  'servicenow.com': 'ServiceNow',
  'workday.com': 'Workday',
  'atlassian.com': 'Atlassian',
  'linkedin.com': 'LinkedIn',
  'uber.com': 'Uber',
  'airbnb.com': 'Airbnb',

  // Indian internet / startups
  'flipkart.com': 'Flipkart',
  'paytm.com': 'Paytm',
  'zomato.com': 'Zomato',
  'swiggy.in': 'Swiggy',
  'oyo.com': 'OYO',
  'byjus.com': "BYJU'S",
  'freshworks.com': 'Freshworks',
  'zoho.com': 'Zoho',
  'ola.com': 'Ola',
  'myntra.com': 'Myntra',
  'nykaa.com': 'Nykaa',
  'phonepe.com': 'PhonePe',
  'razorpay.com': 'Razorpay',
  'cred.club': 'CRED',
  'meesho.com': 'Meesho',
  'urbancompany.com': 'Urban Company',
  'sharechat.com': 'ShareChat',
  'dream11.com': 'Dream11',
  'unacademy.com': 'Unacademy',

  // Banking / finance
  'jpmorgan.com': 'JPMorgan Chase',
  'jpmorganchase.com': 'JPMorgan Chase',
  'goldmansachs.com': 'Goldman Sachs',
  'morganstanley.com': 'Morgan Stanley',
  'hsbc.com': 'HSBC',
  'barclays.com': 'Barclays',
  'citi.com': 'Citi',
  'icicibank.com': 'ICICI Bank',
  'hdfcbank.com': 'HDFC Bank',
  'axisbank.com': 'Axis Bank',
  'sbi.co.in': 'State Bank of India',
  'kotak.com': 'Kotak Mahindra Bank',
};

// Consumer email providers — never a "company" even though the domain
// technically resolves to a well-known brand.
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'aol.com', 'protonmail.com', 'rediffmail.com', 'yandex.com',
]);

function titleCase(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Guesses "Firstname Lastname" from the local-part of an email address.
 * Returns null when no reliable personal-name signal is present
 * (role inboxes like hr@, careers@, etc.), so callers can fall back to
 * "Dear Hiring Manager,".
 */
function deriveNameFromEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;

  const local = email.split('@')[0].toLowerCase();
  // Strip trailing numbers (rahul123 -> rahul) which are usually
  // disambiguation suffixes, not part of the name.
  const stripped = local.replace(/[0-9]+$/g, '');
  if (!stripped) return null;

  const parts = stripped.split(/[._\-+]+/).filter(Boolean);
  if (!parts.length) return null;

  // If every token is a generic role-inbox word, we can't name a person.
  if (parts.every((p) => GENERIC_LOCALPARTS.has(p))) return null;

  // Drop generic filler tokens (e.g. "rahul.hr" -> "rahul") but keep
  // at least one token.
  const meaningful = parts.filter((p) => !GENERIC_LOCALPARTS.has(p));
  const tokens = meaningful.length ? meaningful : parts;

  const name = tokens.map(titleCase).join(' ').trim();
  return name || null;
}

/**
 * Guesses a company display name from an email domain. Known domains
 * resolve to their proper brand name; unknown domains fall back to a
 * title-cased version of the domain's first label.
 */
function deriveCompanyFromEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase().replace(/^www\./, '');
  if (!domain) return null;

  if (KNOWN_DOMAIN_COMPANIES[domain]) return KNOWN_DOMAIN_COMPANIES[domain];

  const labels = domain.split('.');
  // Try the last two labels too (covers subdomains like careers.tcs.com)
  if (labels.length > 2) {
    const rootDomain = labels.slice(-2).join('.');
    if (KNOWN_DOMAIN_COMPANIES[rootDomain]) return KNOWN_DOMAIN_COMPANIES[rootDomain];
  }

  if (FREE_EMAIL_PROVIDERS.has(domain)) return null;

  // Fallback: title-case the first label of the domain, e.g.
  // "abcsoft.in" -> "Abcsoft"
  const base = labels[0] || domain;
  return titleCase(base);
}

module.exports = { deriveNameFromEmail, deriveCompanyFromEmail };
